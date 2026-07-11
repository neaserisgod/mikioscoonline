// Levanta el server standalone localmente contra kiosco.db (SQLite local, con
// una copia de los datos reales de producción bajada por
// kiosco-download-data.ts) — así ventas/productos/stock/caja/rentabilidad son
// instantáneos, sin depender de la red hacia Neon. Login/registro siguen
// yendo siempre a Neon (ver src/lib/prisma-auth.ts), por eso se preserva la
// URL real ANTES de sobreescribir DATABASE_URL acá abajo.
//
// A diferencia de start-local-server.mjs (desarrollo, fuerza dev.db con datos
// de prueba), acá se apunta a kiosco.db (datos reales, bajados a propósito).
import path from "node:path"
import { existsSync } from "node:fs"
import Database from "better-sqlite3"
import { loadEnvFiles } from "./lib/load-env.mjs"

const root = process.cwd()
loadEnvFiles(root)

// Preservar la URL real de Neon ANTES de sobreescribir DATABASE_URL más abajo
// — la usa src/lib/prisma-auth.ts para que login/registro (y las altas/bajas
// de usuarios en config.service.ts) sigan yendo siempre a Neon.
process.env.NEON_DATABASE_URL = process.env.DATABASE_URL

const dbPath = path.resolve(root, process.env.KIOSCO_DB_PATH ?? "kiosco.db")

// Chequeo de seguridad: esta misma mañana el kiosco arrancó por accidente
// contra una base local vacía en vez de los datos reales (ver commit
// 5d131ce) — acá se convierte en un chequeo automático para que eso nunca
// pase desapercibido: si kiosco.db no existe o no tiene productos, el server
// NO arranca.
if (!existsSync(dbPath)) {
  console.error(
    `[kiosco] No existe ${dbPath}. Corré la descarga inicial primero: npm run db:push:kiosco && npm run kiosco:download-data`
  )
  process.exit(1)
}

const db = new Database(dbPath, { readonly: true, fileMustExist: true })
const { c: productos } = db.prepare("SELECT COUNT(*) AS c FROM Product").get()
const { c: ventas } = db.prepare("SELECT COUNT(*) AS c FROM Sale").get()
db.close()

if (productos === 0) {
  console.error(
    `[kiosco] ${dbPath} existe pero tiene 0 productos — la descarga inicial no se corrió o falló. No se arranca contra una base vacía.`
  )
  process.exit(1)
}

console.log(`[kiosco] kiosco.db OK — ${productos} producto(s), ${ventas} venta(s). Arrancando en local.`)

process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, "/")}`
process.env.NODE_ENV = "production"

// Ver la explicación completa en start-local-server.mjs: sin esto, Next arma
// el redirect_uri de Google (y cualquier URL absoluta) con el hostname de
// bind (0.0.0.0) en vez del Host real del navegador.
process.env.HOSTNAME = "localhost"

await import("../.next/standalone/server.js")
