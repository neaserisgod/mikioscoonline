// Genera el archivo `latest.json` que consume el updater de Tauri, leyendo el
// instalador NSIS (`*-setup.exe`) y su firma (`*-setup.exe.sig`) recién buildeados.
//
// Uso (desde la raíz del repo, DESPUÉS de `npx tauri build`):
//   node scripts/gen-latest-json.mjs <version> ["notas de la version"]
//
// Ejemplo:
//   node scripts/gen-latest-json.mjs 0.1.1 "Arreglo de impresion de tickets"
//
// Deja `dist/latest.json` listo para subir a la Release de GitHub junto con el
// `*-setup.exe`. La <version> DEBE coincidir con la de src-tauri/tauri.conf.json
// y con el tag de la release (vX.Y.Z).

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join, resolve } from "node:path"

const REPO = "neaserisgod/mikioscoonline"
const NSIS_DIR = resolve("src-tauri/target/release/bundle/nsis")
const OUT_DIR = resolve("dist")

const version = process.argv[2]
const notes = process.argv[3] ?? "Mejoras y correcciones."

if (!version) {
  console.error("❌ Falta la versión. Uso: node scripts/gen-latest-json.mjs <version> [notas]")
  process.exit(1)
}

if (!existsSync(NSIS_DIR)) {
  console.error(`❌ No existe ${NSIS_DIR}. ¿Corriste "npx tauri build" con createUpdaterArtifacts?`)
  process.exit(1)
}

const files = readdirSync(NSIS_DIR)
const setup = files.find((f) => f.endsWith("-setup.exe"))
const sig = files.find((f) => f.endsWith("-setup.exe.sig"))

if (!setup || !sig) {
  console.error(`❌ No encontré el instalador y/o su .sig en ${NSIS_DIR}`)
  console.error(`   Archivos presentes: ${files.join(", ") || "(ninguno)"}`)
  console.error(`   Verificá que "createUpdaterArtifacts": true esté en tauri.conf.json.`)
  process.exit(1)
}

const signature = readFileSync(join(NSIS_DIR, sig), "utf8").trim()
const url = `https://github.com/${REPO}/releases/download/v${version}/${encodeURIComponent(setup)}`

const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": { signature, url },
  },
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
const outPath = join(OUT_DIR, "latest.json")
writeFileSync(outPath, JSON.stringify(manifest, null, 2))

console.log("✅ Generado:", outPath)
console.log("   Instalador:", setup)
console.log("   URL:", url)
console.log("")
console.log("Ahora creá la Release v" + version + " en GitHub y subí como assets:")
console.log("   1) " + join(NSIS_DIR, setup))
console.log("   2) " + outPath)
