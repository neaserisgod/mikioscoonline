// Descarga el node.exe oficial de Windows x64 a src-tauri/resources/node/node.exe
// para bundlear en el instalador (ver "resources" en tauri.conf.json y
// node_binario() en src-tauri/src/lib.rs) — así la app no depende de tener
// Node instalado en la PC del comercio.
//
// Idempotente: si ya está la versión pineada (chequea corriendo
// `node.exe --version`), no vuelve a descargar. Verifica el SHA-256 contra
// SHASUMS256.txt de nodejs.org antes de dar el binario por bueno.
//
// Uso: node scripts/fetch-node.mjs
// Se corre solo desde scripts/release.mjs antes de `tauri build`.

import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync } from "node:fs"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import path from "node:path"

// LTS ("Krypton") vigente al momento de escribir esto. Next 16 requiere Node
// 18.18+; se pinea una LTS reciente a propósito. Actualizar acá cuando
// corresponda migrar de LTS.
export const NODE_VERSION = "24.18.0"

const DIST_BASE = `https://nodejs.org/dist/v${NODE_VERSION}`
const EXE_URL = `${DIST_BASE}/win-x64/node.exe`
const SHASUMS_URL = `${DIST_BASE}/SHASUMS256.txt`

const ROOT = path.resolve(import.meta.dirname, "..")
const OUT_DIR = path.join(ROOT, "src-tauri", "resources", "node")
const OUT_PATH = path.join(OUT_DIR, "node.exe")

function versionInstalada() {
  if (!existsSync(OUT_PATH)) return null
  try {
    return execFileSync(OUT_PATH, ["--version"], { encoding: "utf8" }).trim().replace(/^v/, "")
  } catch {
    return null
  }
}

async function sha256Esperado() {
  const res = await fetch(SHASUMS_URL)
  if (!res.ok) throw new Error(`No pude bajar SHASUMS256.txt (HTTP ${res.status})`)
  const texto = await res.text()
  const linea = texto.split("\n").find((l) => l.trim().endsWith("win-x64/node.exe"))
  if (!linea) throw new Error("No encontré la entrada de win-x64/node.exe en SHASUMS256.txt")
  return linea.trim().split(/\s+/)[0]
}

function sha256DeArchivo(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex")
}

async function descargar() {
  console.log(`Descargando node.exe v${NODE_VERSION} (win-x64) de ${EXE_URL}…`)
  const res = await fetch(EXE_URL)
  if (!res.ok) throw new Error(`No pude descargar node.exe (HTTP ${res.status})`)

  mkdirSync(OUT_DIR, { recursive: true })
  const tmpPath = `${OUT_PATH}.download`
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmpPath))

  console.log("Verificando checksum SHA-256 contra SHASUMS256.txt…")
  const esperado = await sha256Esperado()
  const real = sha256DeArchivo(tmpPath)
  if (real !== esperado) {
    unlinkSync(tmpPath)
    throw new Error(`Checksum inválido para node.exe — esperado ${esperado}, obtuve ${real}. Abortando (no dejo un binario sin verificar).`)
  }

  renameSync(tmpPath, OUT_PATH)
  console.log(`OK — node.exe v${NODE_VERSION} verificado y guardado en ${OUT_PATH}`)
}

async function main() {
  const actual = versionInstalada()
  if (actual === NODE_VERSION) {
    console.log(`node.exe v${NODE_VERSION} ya está en ${OUT_PATH} — nada que hacer.`)
    return
  }
  if (actual) {
    console.log(`Hay un node.exe v${actual} pero la versión pineada es v${NODE_VERSION} — vuelvo a descargar.`)
  }
  await descargar()
}

main().catch((e) => {
  console.error(`\n❌ ${e.message}\n`)
  process.exit(1)
})
