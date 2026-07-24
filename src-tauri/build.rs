use std::fs;
use std::path::Path;

// Hornea AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET en el binario en build-time, leyendo
// el .env.local del proyecto (../.env.local desde acá) — son las credenciales
// del cliente OAuth, IGUALES para todas las cajas (no hay nada "secreto por
// instalación" en ellas, a diferencia de AUTH_SECRET/KIOSCO_BACKUP_TOKEN, que
// sí se generan uno por instalación en config.env). Antes había que copiarlas
// a mano en cada config.env nuevo — cualquier reinstalación limpia (o un
// desinstalador que borre los datos) rompía "Continuar con Google" hasta que
// alguien las volviera a pegar. Con esto, load_or_init_config_env (lib.rs) las
// completa solo si config.env no las tiene.
//
// NEON_DATABASE_URL queda deliberadamente AFUERA de este mecanismo: es la
// credencial con acceso de escritura completo a la base de producción —
// hornearla en un binario que se distribuye sería un riesgo real (cualquiera
// con el .exe podría extraerla). Esa sigue siendo manual a propósito.
fn hornear_env_var(nombre: &str) {
    let ruta = Path::new(env!("CARGO_MANIFEST_DIR")).join("../.env.local");
    println!("cargo:rerun-if-changed={}", ruta.display());

    let valor = fs::read_to_string(&ruta)
        .ok()
        .and_then(|contenido| {
            contenido.lines().find_map(|linea| {
                let linea = linea.trim();
                let (k, v) = linea.split_once('=')?;
                if k.trim() != nombre {
                    return None;
                }
                Some(v.trim().trim_matches('"').to_string())
            })
        })
        .unwrap_or_default();

    println!("cargo:rustc-env=BAKED_{nombre}={valor}");
}

fn main() {
    hornear_env_var("AUTH_GOOGLE_ID");
    hornear_env_var("AUTH_GOOGLE_SECRET");
    tauri_build::build()
}
