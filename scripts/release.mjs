// Publica una nueva versión de la app de escritorio en UN solo comando.
//
// Reemplaza el flujo manual de varios pasos (subir versión en dos archivos,
// buildear firmado, generar latest.json, crear la release a mano y subir los
// assets). Ver docs/actualizaciones-app.md para el detalle de cada paso.
//
// Uso (desde la raíz del repo, en Windows con las claves de firma cargadas):
//
//   $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $env:USERPROFILE\.tauri\kiosco.key -Raw
//   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "tu-password-o-vacio"
//   npm run release 1.0.3 "Arreglo de impresión de tickets"
//
// Flags opcionales (después de la versión y las notas):
//   --skip-build   No vuelve a buildear (usa el instalador ya presente en
//                  src-tauri/target/release/bundle/nsis). Útil para reintentar
//                  solo la publicación si el build ya salió bien.
//   --no-publish   No crea la release en GitHub aunque haya `gh` instalado;
//                  deja todo listo y te dice qué subir a mano.
//
// Si el CLI `gh` (GitHub CLI) está instalado y con sesión iniciada, el script
// crea la release `vX.Y.Z` y sube el instalador + latest.json solo. Si no,
// imprime los pasos manuales para terminar.

import { execSync } from "node:child_process"
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs"
import { resolve, join } from "node:path"

const ROOT = resolve(import.meta.dirname, "..")
const PKG_PATH = join(ROOT, "package.json")
const TAURI_CONF_PATH = join(ROOT, "src-tauri", "tauri.conf.json")
const NSIS_DIR = join(ROOT, "src-tauri", "target", "release", "bundle", "nsis")

// ── Parseo de argumentos ────────────────────────────────────────────────────
const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith("--")))
const positional = args.filter((a) => !a.startsWith("--"))
const version = positional[0]
const notes = positional[1] ?? "Mejoras y correcciones."

const SKIP_BUILD = flags.has("--skip-build")
const NO_PUBLISH = flags.has("--no-publish")

function die(msg) {
  console.error(`\n❌ ${msg}\n`)
  process.exit(1)
}

if (!version) {
  die(
    'Falta la versión. Uso: npm run release <X.Y.Z> ["notas"] [--skip-build] [--no-publish]',
  )
}
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  die(`Versión inválida: "${version}". Usá el formato X.Y.Z (ej. 1.0.3).`)
}

const tag = `v${version}`
const run = (cmd, opts = {}) =>
  execSync(cmd, { cwd: ROOT, stdio: "inherit", ...opts })
const capture = (cmd) =>
  execSync(cmd, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] })
    .toString()
    .trim()

// ── 0. Chequeos previos ─────────────────────────────────────────────────────
console.log(`\n🚀 Preparando release ${tag}\n`)

if (!SKIP_BUILD && !process.env.TAURI_SIGNING_PRIVATE_KEY) {
  die(
    "No está seteada TAURI_SIGNING_PRIVATE_KEY. Cargá la clave privada de firma\n" +
      "   antes de buildear (ver docs/actualizaciones-app.md):\n\n" +
      "   $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $env:USERPROFILE\\.tauri\\kiosco.key -Raw\n" +
      "   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = \"tu-password-o-vacio\"\n",
  )
}

// El tag no debe existir ya (evita pisar una release publicada).
try {
  const existentes = capture("git tag").split("\n")
  if (existentes.includes(tag)) {
    die(`El tag ${tag} ya existe. ¿Ya publicaste esta versión? Subí el número.`)
  }
} catch {
  /* sin git o sin tags todavía — seguimos */
}

// ── 1. Subir el número de versión en los dos archivos ───────────────────────
function bumpJson(path, label) {
  const raw = readFileSync(path, "utf8")
  const data = JSON.parse(raw)
  const anterior = data.version
  data.version = version
  // Reescribe preservando 2 espacios de indentación y newline final.
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n")
  console.log(`   ${label}: ${anterior} → ${version}`)
}

console.log("📝 Actualizando versión…")
bumpJson(PKG_PATH, "package.json")
bumpJson(TAURI_CONF_PATH, "src-tauri/tauri.conf.json")

// ── 2. Buildear firmado (server standalone + bundle Tauri) ──────────────────
if (SKIP_BUILD) {
  console.log("\n⏭️  --skip-build: uso el instalador ya presente.")
} else {
  console.log("\n🔨 Buildeando el server standalone…")
  run("npm run build:standalone")
  console.log("\n⬇️  Verificando node.exe bundleado…")
  run("node scripts/fetch-node.mjs")
  console.log("\n🔨 Buildeando el bundle Tauri (firmado)…")
  run("npx tauri build")
}

// ── 3. Generar latest.json ──────────────────────────────────────────────────
console.log("\n🧾 Generando latest.json…")
run(`node scripts/gen-latest-json.mjs ${version} ${JSON.stringify(notes)}`)

// Ubicar los assets que hay que subir. Filtramos por la versión exacta: el
// directorio puede tener instaladores de builds anteriores que Tauri no
// limpia solo, y no queremos publicar por error el .exe de una versión vieja.
if (!existsSync(NSIS_DIR)) {
  die(`No existe ${NSIS_DIR}. ¿Corrió bien el build?`)
}
const setup = readdirSync(NSIS_DIR).find(
  (f) => f.endsWith("-setup.exe") && f.includes(`_${version}_`),
)
if (!setup) die(`No encontré el instalador -setup.exe de la versión ${version} en ${NSIS_DIR}.`)
const setupPath = join(NSIS_DIR, setup)
const latestJsonPath = join(ROOT, "dist", "latest.json")

// ── 4. Commit del bump de versión ───────────────────────────────────────────
try {
  run("git add package.json src-tauri/tauri.conf.json")
  run(`git commit -m "release: ${tag}"`)
  console.log(`\n✅ Commit del bump de versión hecho.`)
} catch {
  console.log(
    "\n⚠️  No pude commitear el bump (¿sin cambios o sin git?). Seguí igual.",
  )
}

// ── 5. Publicar la release (gh CLI si está disponible) ──────────────────────
function tieneGh() {
  try {
    capture("gh --version")
    return true
  } catch {
    return false
  }
}

if (!NO_PUBLISH && tieneGh()) {
  console.log("\n☁️  Creando la release en GitHub con `gh`…")
  try {
    run("git push")
    run(
      `gh release create ${tag} ${JSON.stringify(setupPath)} ${JSON.stringify(
        latestJsonPath,
      )} --title ${JSON.stringify(tag)} --notes ${JSON.stringify(notes)}`,
    )
    console.log(`\n🎉 Release ${tag} publicada. Las cajas se actualizan solas al abrir.`)
  } catch {
    die(
      "Falló la publicación con `gh`. Revisá que tengas sesión (`gh auth status`)\n" +
        "   y subí los assets a mano (ver abajo).",
    )
  }
} else {
  console.log("\n📦 Listo para publicar a mano. En GitHub → Releases → Draft a new release:")
  console.log(`   • Tag: ${tag}`)
  console.log(`   • Subí estos dos assets:`)
  console.log(`       1) ${setupPath}`)
  console.log(`       2) ${latestJsonPath}`)
  console.log(`   • Notas: ${notes}`)
  if (!NO_PUBLISH) {
    console.log(
      "\n   (Instalá GitHub CLI `gh` y este paso se hace solo la próxima vez.)",
    )
  }
}
