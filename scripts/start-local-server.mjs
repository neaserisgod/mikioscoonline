// El server standalone (`.next/standalone/server.js`) es Node puro — a
// diferencia de `next dev`/`next start`, NO carga `.env`/`.env.local`
// automáticamente. Sin esto, NextAuth rechaza el host (AUTH_TRUST_HOST
// nunca llega) y faltan AUTH_SECRET/MP_*/etc en runtime.
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"

const root = process.cwd()

function loadEnvFile(filename) {
  const filePath = path.join(root, filename)
  if (!existsSync(filePath)) return
  const content = readFileSync(filePath, "utf-8")
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

// Mismo orden de precedencia que usa Next.js: .env primero, .env.local pisa.
loadEnvFile(".env")
loadEnvFile(".env.local")

// Fuerza SQLite local pase lo que pase en .env.local (que apunta a la
// Postgres de producción) — ver lección ya conocida sobre dev:local.
// Ruta ABSOLUTA a propósito: `.next/standalone/server.js` hace
// `process.chdir(__dirname)` al cargar (comportamiento estándar de Next.js
// standalone), así que un "file:./dev.db" relativo terminaría resolviendo
// dentro de `.next/standalone/` y creando una base vacía nueva ahí.
process.env.LOCAL_DEV = "1"
process.env.DATABASE_URL = `file:${path.join(root, "dev.db").replace(/\\/g, "/")}`
process.env.NODE_ENV = "production"

// El server.js standalone hace `const hostname = process.env.HOSTNAME || '0.0.0.0'`
// y, como next.config.ts no tiene `experimental.trustHostHeader`, Next arma la URL
// interna del request con ESE hostname en vez del header `Host` real del navegador
// (ver next/dist/server/lib/router-utils/resolve-routes.js). Sin esto, NextAuth arma
// el redirect_uri de Google con "0.0.0.0:3000" y Google lo rechaza (no está
// autorizado, y aunque lo estuviera, el navegador nunca pega contra 0.0.0.0).
process.env.HOSTNAME = "localhost"

await import("../.next/standalone/server.js")
