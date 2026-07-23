use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::net::TcpStream;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{Manager, State};
use tauri_plugin_updater::UpdaterExt;

const PORT: u16 = 3210;

struct ServerProcess(Mutex<Option<Child>>);

// `resource_dir()`/`app_data_dir()` en Windows pueden venir con el prefijo verbatim
// `\\?\` (paths extendidos) — Node.js no lo resuelve bien en su módulo de resolución
// (rompe con EISDIR al hacer lstat de solo la letra de unidad). Se lo sacamos antes
// de pasarle cualquier path a `node`.
fn strip_verbatim_prefix(path: &std::path::Path) -> std::path::PathBuf {
    let s = path.to_string_lossy();
    match s.strip_prefix(r"\\?\") {
        Some(rest) => std::path::PathBuf::from(rest),
        None => path.to_path_buf(),
    }
}

// El server Next.js standalone corre siempre en la misma PC (ver Fase 2 del plan),
// así que no necesita ser un "sidecar" empaquetado por Tauri — se invoca el `node`
// del sistema (requisito documentado de esta v1) sobre el recurso bundleado.
// La app es `windows_subsystem = "windows"` (sin consola) en release, así que
// `Stdio::inherit()` no va a ningún lado — cualquier `console.error`/`logError`
// del server Next se perdía en el aire. Se redirige a archivos en la carpeta de
// datos del usuario, mismo nombre/convención que usaba el lanzador Edge viejo
// (`scripts/windows/start-kiosco.ps1` → `logs/server.log`/`server-error.log`),
// para poder diagnosticar sin tener que reabrir la app con una consola pegada.
// Se trunca en cada arranque (no se acumula sin límite): alcanza con la corrida
// más reciente para depurar "por qué no arrancó"/"qué pasó en esta sesión".
fn abrir_log(data_dir: &std::path::Path, nombre: &str) -> std::io::Result<std::fs::File> {
    let logs_dir = data_dir.join("logs");
    fs::create_dir_all(&logs_dir)?;
    fs::File::create(logs_dir.join(nombre))
}

fn spawn_node_server(resource_dir: &std::path::Path, data_dir: &std::path::Path, env: &HashMap<String, String>) -> std::io::Result<Child> {
    let resource_dir = strip_verbatim_prefix(resource_dir);
    let data_dir = strip_verbatim_prefix(data_dir);
    let db_path = data_dir.join("dev.db");
    let db_url = format!("file:{}", db_path.to_string_lossy().replace('\\', "/"));

    let stdout_log = abrir_log(&data_dir, "server.log")?;
    let stderr_log = abrir_log(&data_dir, "server-error.log")?;

    let mut cmd = Command::new("node");
    cmd.arg("server.js")
        .current_dir(resource_dir.join("next-standalone"))
        .env("NODE_ENV", "production")
        .env("LOCAL_DEV", "1")
        .env("PORT", PORT.to_string())
        .env("HOSTNAME", "127.0.0.1")
        .env("AUTH_TRUST_HOST", "true")
        .env("DATABASE_URL", db_url)
        .stdout(Stdio::from(stdout_log))
        .stderr(Stdio::from(stderr_log));

    for (k, v) in env {
        cmd.env(k, v);
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.spawn()
}

// Genera el secret una sola vez con el mismo Node del sistema (ya es una dependencia
// obligatoria de esta v1, evita sumar un crate de Rust solo para esto).
fn generate_secret() -> String {
    let output = Command::new("node")
        .args(["-e", "console.log(require('crypto').randomBytes(32).toString('hex'))"])
        .output()
        .expect("no se pudo generar AUTH_SECRET (¿Node.js está instalado?)");
    String::from_utf8_lossy(&output.stdout).trim().to_string()
}

// Formato simple KEY=VALUE por línea, un archivo editable a mano para cargar
// secretos de MercadoPago/AFIP sin tener que recompilar la app.
fn load_or_init_config_env(path: &std::path::Path) -> HashMap<String, String> {
    let mut vars = HashMap::new();
    if let Ok(mut file) = fs::File::open(path) {
        let mut contents = String::new();
        file.read_to_string(&mut contents).ok();
        for line in contents.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((k, v)) = line.split_once('=') {
                vars.insert(k.trim().to_string(), v.trim().trim_matches('"').to_string());
            }
        }
    }

    if !vars.contains_key("AUTH_SECRET") {
        vars.insert("AUTH_SECRET".to_string(), generate_secret());
        let mut out = String::new();
        for (k, v) in &vars {
            out.push_str(&format!("{k}=\"{v}\"\n"));
        }
        out.push_str("\n# Completar acá MP_ACCESS_TOKEN / MP_PUBLIC_KEY / MP_WEBHOOK_SECRET / PAGOS_PROVIDER\n# cuando corresponda cobrar con MercadoPago desde esta PC.\n# Completar también AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET (mismos valores que\n# en .env.local del proyecto) para habilitar \"Continuar con Google\" acá.\n");
        fs::write(path, out).ok();
    }

    vars
}

fn ensure_local_db(resource_dir: &std::path::Path, data_dir: &std::path::Path) {
    let db_path = data_dir.join("dev.db");
    if db_path.exists() {
        return;
    }
    let template = resource_dir.join("dev-template.db");
    fs::copy(&template, &db_path).expect("no se pudo inicializar la base local desde la plantilla");
}

// Chequea GitHub Releases al arrancar y, si hay una versión más nueva, la
// descarga e instala ANTES de levantar el server Node. Se hace acá (y no en un
// hilo aparte) a propósito: si primero spawneáramos el server y después
// reiniciáramos por un update, el proceso `node` quedaría huérfano ocupando el
// puerto 3210 y la nueva instancia no podría bindear. Al chequear primero, o
// bien reiniciamos limpio (nunca llegamos a spawnear node), o bien seguimos el
// arranque normal. La ventana ya muestra la loading-page mientras tanto.
//
// El timeout corto evita que una PC sin internet (o con red lenta) trabe la
// apertura de la caja: si el chequeo no responde, se ignora y la app abre igual.
fn apply_update_if_available(handle: &tauri::AppHandle) {
    let updater = match handle
        .updater_builder()
        .timeout(Duration::from_secs(15))
        .build()
    {
        Ok(u) => u,
        Err(e) => {
            log::warn!("Updater no disponible ({e}); se abre sin chequear updates.");
            return;
        }
    };

    let result = tauri::async_runtime::block_on(async move { updater.check().await });

    match result {
        Ok(Some(update)) => {
            let version = update.version.clone();
            log::info!("Actualización {version} disponible — descargando…");
            let install = tauri::async_runtime::block_on(async move {
                update.download_and_install(|_downloaded, _total| {}, || {}).await
            });
            match install {
                Ok(_) => {
                    log::info!("Actualización {version} instalada — reiniciando la app.");
                    handle.restart();
                }
                Err(e) => log::error!("Falló la instalación de la actualización: {e}"),
            }
        }
        Ok(None) => log::info!("La app ya está en la última versión."),
        Err(e) => log::warn!("No se pudo chequear actualizaciones ({e}); se abre igual."),
    }
}

fn wait_for_server(port: u16, timeout: Duration) -> bool {
    let start = std::time::Instant::now();
    while start.elapsed() < timeout {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(ServerProcess(Mutex::new(None)))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Chequeo de actualizaciones ANTES de levantar el server local.
            // Si hay update, esta llamada instala y reinicia (no vuelve).
            // En release el updater usa el endpoint/pubkey de tauri.conf.json.
            apply_update_if_available(app.handle());

            let resource_dir = app.path().resource_dir()?;
            let data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&data_dir)?;

            ensure_local_db(&resource_dir, &data_dir);
            let env = load_or_init_config_env(&data_dir.join("config.env"));

            let child = spawn_node_server(&resource_dir, &data_dir, &env)
                .expect("no se pudo iniciar el servidor local — ¿Node.js está instalado?");

            let state: State<ServerProcess> = app.state();
            *state.0.lock().unwrap() = Some(child);

            let window = app.get_webview_window("main").unwrap();
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                if wait_for_server(PORT, Duration::from_secs(30)) {
                    // Auth.js/Next construyen internamente el origin de las requests
                    // (redirect_uri de OAuth, cookies de csrf/pkce) como "localhost",
                    // no como "127.0.0.1" — si la ventana navega a 127.0.0.1, las
                    // cookies de PKCE quedan en un origin distinto al que usa el
                    // callback de Google y el login con Google falla. Navegamos
                    // directo a localhost para que todo quede bajo el mismo origin.
                    let url = format!("http://localhost:{PORT}").parse().unwrap();
                    window.navigate(url).ok();
                } else {
                    log::error!("El servidor local no respondió después de 30s");
                }
                let _ = handle;
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state: State<ServerProcess> = window.state();
                let taken = state.0.lock().unwrap().take();
                if let Some(mut child) = taken {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
