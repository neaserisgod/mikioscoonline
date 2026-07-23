use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{Manager, State};
use tauri_plugin_updater::UpdaterExt;

const PORT: u16 = 3210;

struct ServerProcess(Mutex<Option<Child>>);

// Token compartido con /api/kiosco-backup-automatico (ver esa ruta): lo
// generamos una vez en config.env (load_or_init_config_env) y lo mandamos
// como env var al server Node al spawnear, así el propio server valida que
// el POST vino de esta misma app y no de cualquier otro proceso local.
struct BackupConfig {
    token: String,
}

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

    // AUTH_SECRET (sesión) y KIOSCO_BACKUP_TOKEN (autoriza el POST interno de
    // backup automático que hace esta misma app, ver post_local/spawn_backup_uploader
    // más abajo) se generan una sola vez cada uno, independientemente — una
    // caja que ya tenía AUTH_SECRET de una versión anterior recién ahora
    // recibe también el token, sin regenerar el secret de sesión existente.
    let mut cambio = false;
    if !vars.contains_key("AUTH_SECRET") {
        vars.insert("AUTH_SECRET".to_string(), generate_secret());
        cambio = true;
    }
    if !vars.contains_key("KIOSCO_BACKUP_TOKEN") {
        vars.insert("KIOSCO_BACKUP_TOKEN".to_string(), generate_secret());
        cambio = true;
    }

    if cambio {
        let mut out = String::new();
        for (k, v) in &vars {
            out.push_str(&format!("{k}=\"{v}\"\n"));
        }
        out.push_str("\n# Completar acá MP_ACCESS_TOKEN / MP_PUBLIC_KEY / MP_WEBHOOK_SECRET / PAGOS_PROVIDER\n# cuando corresponda cobrar con MercadoPago desde esta PC.\n# Completar también AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET (mismos valores que\n# en .env.local del proyecto) para habilitar \"Continuar con Google\" acá.\n");
        fs::write(path, out).ok();
    }

    vars
}

// Devuelve true si tuvo que copiar la plantilla ahora mismo (instalación
// nueva) — lo usa `run()` para sembrar la tabla de control de migraciones
// (ver `seed_migraciones_aplicadas`) y no reintentar de más.
fn ensure_local_db(resource_dir: &std::path::Path, data_dir: &std::path::Path) -> bool {
    let db_path = data_dir.join("dev.db");
    if db_path.exists() {
        return false;
    }
    let template = resource_dir.join("dev-template.db");
    fs::copy(&template, &db_path).expect("no se pudo inicializar la base local desde la plantilla");
    true
}

const TABLA_MIGRACIONES: &str = r#"
CREATE TABLE IF NOT EXISTS "_kiosco_schema_migrations" (
    "nombre" TEXT PRIMARY KEY NOT NULL,
    "aplicada_en" TEXT NOT NULL DEFAULT (datetime('now'))
)
"#;

fn nombres_migraciones_bundleadas(resource_dir: &std::path::Path) -> Vec<String> {
    let dir = resource_dir.join("migraciones-sqlite");
    let Ok(entries) = fs::read_dir(&dir) else { return Vec::new() };
    let mut nombres: Vec<String> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .filter(|n| n.ends_with(".sql"))
        .collect();
    nombres.sort();
    nombres
}

// Instalación NUEVA: la plantilla recién copiada ya tiene horneado el schema
// de esta release, así que los .sql bundleados no hay que ejecutarlos — solo
// registrarlos como aplicados para que `apply_pending_migrations` no intente
// correrlos (fallarían, ej. "table already exists").
fn seed_migraciones_aplicadas(data_dir: &std::path::Path, resource_dir: &std::path::Path) {
    let db_path = data_dir.join("dev.db");
    let conn = match rusqlite::Connection::open(&db_path) {
        Ok(c) => c,
        Err(e) => {
            log::error!("No se pudo abrir dev.db para sembrar la tabla de migraciones: {e}");
            return;
        }
    };
    if let Err(e) = conn.execute_batch(TABLA_MIGRACIONES) {
        log::error!("No se pudo crear _kiosco_schema_migrations: {e}");
        return;
    }
    for nombre in nombres_migraciones_bundleadas(resource_dir) {
        let _ = conn.execute(
            r#"INSERT OR IGNORE INTO "_kiosco_schema_migrations" (nombre) VALUES (?1)"#,
            [nombre],
        );
    }
}

// Aplica, en orden, los .sql de `migraciones-sqlite/` que todavía no estén
// registrados en `_kiosco_schema_migrations` — para cajas que venían de una
// instalación anterior (no nueva, ver `seed_migraciones_aplicadas`). Cada
// migración corre en su propia transacción junto con el registro de que se
// aplicó: si falla, no queda rastro y se reintenta sola en el próximo
// arranque. Si falla, se aborta el arranque (mejor eso que abrir la app
// contra un schema a medio migrar).
fn apply_pending_migrations(resource_dir: &std::path::Path, data_dir: &std::path::Path) {
    let dir = resource_dir.join("migraciones-sqlite");
    let db_path = data_dir.join("dev.db");

    let mut conn = rusqlite::Connection::open(&db_path)
        .expect("no se pudo abrir dev.db para aplicar migraciones de schema");
    conn.execute_batch(TABLA_MIGRACIONES)
        .expect("no se pudo crear la tabla de control de migraciones");

    let ya_aplicadas: std::collections::HashSet<String> = conn
        .prepare(r#"SELECT nombre FROM "_kiosco_schema_migrations""#)
        .and_then(|mut stmt| {
            let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
            rows.collect::<Result<Vec<_>, _>>()
        })
        .map(|v| v.into_iter().collect())
        .unwrap_or_default();

    let mut log_lines = String::new();
    let mut aplicadas_ahora = 0;

    for nombre in nombres_migraciones_bundleadas(resource_dir) {
        if ya_aplicadas.contains(&nombre) {
            continue;
        }
        let sql = fs::read_to_string(dir.join(&nombre))
            .unwrap_or_else(|e| panic!("no se pudo leer la migración {nombre}: {e}"));

        let tx = conn
            .transaction()
            .expect("no se pudo abrir una transacción para migrar dev.db");
        tx.execute_batch(&sql)
            .unwrap_or_else(|e| panic!("la migración {nombre} falló contra dev.db: {e}"));
        tx.execute(
            r#"INSERT INTO "_kiosco_schema_migrations" (nombre) VALUES (?1)"#,
            [&nombre],
        )
        .expect("no se pudo registrar la migración aplicada");
        tx.commit().expect("no se pudo confirmar la migración");

        log_lines.push_str(&format!("Aplicada: {nombre}\n"));
        aplicadas_ahora += 1;
    }

    if aplicadas_ahora == 0 {
        log_lines.push_str("Sin migraciones pendientes.\n");
    }
    if let Ok(mut f) = abrir_log(data_dir, "migraciones.log") {
        let _ = f.write_all(log_lines.as_bytes());
    }
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

// POST mínimo hecho a mano por TcpStream (sin sumar un crate de HTTP client
// solo para esto — mismo criterio que generate_secret con `node`): pega
// contra /api/kiosco-backup-automatico en 127.0.0.1, nunca sale a la red.
// Devuelve true solo si el server respondió 200. `timeout` acota tanto la
// conexión como la espera de respuesta — importante para el intento al
// cerrar la ventana, que no debe trabar el cierre si Neon está lento/caído.
fn post_local(port: u16, path: &str, token: &str, timeout: Duration) -> bool {
    let Ok(stream) = TcpStream::connect(("127.0.0.1", port)) else { return false };
    stream.set_write_timeout(Some(timeout)).ok();
    stream.set_read_timeout(Some(timeout)).ok();
    let mut stream = stream;

    let request = format!(
        "POST {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nAuthorization: Bearer {token}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n"
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }

    let mut respuesta = String::new();
    if stream.read_to_string(&mut respuesta).is_err() {
        return false;
    }
    respuesta.starts_with("HTTP/1.1 200") || respuesta.starts_with("HTTP/1.0 200")
}

// Timer propio del backup automático (reemplaza, para la app Tauri, al
// scheduler nocturno fijo de scripts/kiosco-backup-scheduler.mjs — ese sigue
// existiendo tal cual para el lanzador Edge viejo, que arranca aparte). A
// diferencia de un backup diario a hora fija, correr cada N minutos MIENTRAS
// la caja está abierta cubre el caso real de un comercio que cierra antes de
// cualquier hora fija — y el intento en on_window_event (más abajo) cubre el
// momento del cierre mismo. subirCambiosLocales es upsert idempotente
// (nunca borra/pisa nada local), así que llamarlo seguido es seguro y barato
// cuando no hay nada nuevo.
fn spawn_backup_uploader(token: String, data_dir: std::path::PathBuf, intervalo_min: u64) {
    std::thread::spawn(move || {
        if !wait_for_server(PORT, Duration::from_secs(30)) {
            return;
        }
        let mut log = abrir_log(&data_dir, "backup-automatico.log").ok();
        let intervalo = Duration::from_secs(intervalo_min.max(1) * 60);
        loop {
            let ok = post_local(PORT, "/api/kiosco-backup-automatico", &token, Duration::from_secs(30));
            if let Some(f) = log.as_mut() {
                let linea = if ok { "OK\n" } else { "FALLÓ (sin respuesta / sin conexión)\n" };
                let _ = f.write_all(linea.as_bytes());
            }
            std::thread::sleep(intervalo);
        }
    });
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

            let instalacion_nueva = ensure_local_db(&resource_dir, &data_dir);
            if instalacion_nueva {
                seed_migraciones_aplicadas(&data_dir, &resource_dir);
            }
            apply_pending_migrations(&resource_dir, &data_dir);
            let env = load_or_init_config_env(&data_dir.join("config.env"));

            let backup_token = env.get("KIOSCO_BACKUP_TOKEN").cloned().unwrap_or_default();
            let intervalo_min: u64 = env
                .get("KIOSCO_BACKUP_INTERVALO_MIN")
                .and_then(|v| v.parse().ok())
                .unwrap_or(10);
            app.manage(BackupConfig { token: backup_token.clone() });

            let child = spawn_node_server(&resource_dir, &data_dir, &env)
                .expect("no se pudo iniciar el servidor local — ¿Node.js está instalado?");

            let state: State<ServerProcess> = app.state();
            *state.0.lock().unwrap() = Some(child);

            // Solo tiene sentido si esta caja está vinculada a producción — sin
            // NEON_DATABASE_URL en config.env no hay a dónde subir nada.
            if env.contains_key("NEON_DATABASE_URL") {
                spawn_backup_uploader(backup_token, data_dir.clone(), intervalo_min);
            }

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
                // Último intento de subir lo que haya quedado, con timeout corto
                // a propósito: si Neon está lento/caído no debe trabar el cierre
                // de la app — el próximo arranque (o el timer mientras corría)
                // ya lo va a reintentar.
                let backup: State<BackupConfig> = window.state();
                if !backup.token.is_empty() {
                    post_local(PORT, "/api/kiosco-backup-automatico", &backup.token, Duration::from_secs(5));
                }

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
