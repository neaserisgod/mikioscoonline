import { readFileSync, existsSync } from "node:fs"
import path from "node:path"

// Mismo orden de precedencia que usa Next.js: cada loadEnvFile solo completa
// claves que todavía no están seteadas, así que el archivo que se carga
// PRIMERO gana. Next.js carga .env.local antes que .env, por eso acá también
// — si el orden se invierte, cualquier clave presente en ambos (como
// DATABASE_URL) termina resolviendo al valor de .env en vez de .env.local.
export function loadEnvFiles(root) {
  loadEnvFile(root, ".env.local")
  loadEnvFile(root, ".env")
}

function loadEnvFile(root, filename) {
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
