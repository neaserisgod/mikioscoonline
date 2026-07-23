// Genera un `config.env` listo para copiar a una caja nueva, leyendo las
// credenciales reales de `.env.local` (mismo criterio que se usó a mano la
// primera vez: MP/AFIP/Google reales, pero NUNCA DATABASE_URL/DIRECT_URL —
// eso apuntaría la caja directo a Neon en vez de su sqlite local — ni
// AUTH_SECRET, que cada caja debe generar solo, ver src-tauri/src/lib.rs).
//
// Uso (desde la raíz del repo):
//   node scripts/gen-config-caja-nueva.mjs
//
// Deja `dist/config-caja-nueva.env` listo para copiar a
// %APPDATA%\ar.kioscoelbarrio.pos\config.env en la PC nueva (por USB o lo que
// tengas a mano — no sale de esta máquina sola).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { resolve } from "node:path"

const ENV_LOCAL = resolve(".env.local")
const OUT_DIR = resolve("dist")
const OUT_FILE = resolve(OUT_DIR, "config-caja-nueva.env")

// Claves reales de prod a copiar (pagos MP + facturación AFIP + login Google +
// sync inicial de datos vía /vincular-caja). Deliberadamente EXCLUIDAS:
// DATABASE_URL/DIRECT_URL (la caja debe seguir usando su sqlite local para
// todo lo que no sea auth/sync), AUTH_SECRET (cada caja genera el suyo al
// arrancar), SEED_ADMIN_PASSWORD/KIOSCO_OWNER_EMAIL (solo scripts de seed),
// MP_PREAPPROVAL_PLAN_ID (suscripción del SaaS, no cobros del POS),
// MP_WEBHOOK_SECRET (un webhook de MP nunca llega a una PC de escritorio sin
// URL pública).
const CLAVES = [
  "PAGOS_PROVIDER",
  "MP_ACCESS_TOKEN",
  "MP_PUBLIC_KEY",
  "FACTURACION_PROVIDER",
  "AFIP_CUIT",
  "AFIP_CERT",
  "AFIP_PRIVATE_KEY",
  "AFIP_ACCESS_TOKEN",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "NEON_DATABASE_URL",
]

function parseEnvFile(contenido) {
  const vars = {}
  for (const rawLine of contenido.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const idx = line.indexOf("=")
    if (idx === -1) continue
    const k = line.slice(0, idx).trim()
    let v = line.slice(idx + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    vars[k] = v
  }
  return vars
}

if (!existsSync(ENV_LOCAL)) {
  console.error(`❌ No existe ${ENV_LOCAL}`)
  process.exit(1)
}

const prod = parseEnvFile(readFileSync(ENV_LOCAL, "utf8"))
// NEON_DATABASE_URL no existe como key propia en .env.local — usa la misma
// DATABASE_URL (pooler) que ya usa kiosco-download-data.ts por default.
const neonUrl = prod.NEON_DATABASE_URL ?? prod.DATABASE_URL

let out = ""
const faltantes = []
for (const clave of CLAVES) {
  const valor = clave === "NEON_DATABASE_URL" ? neonUrl : prod[clave]
  if (!valor) {
    faltantes.push(clave)
    continue
  }
  out += `${clave}="${valor}"\n`
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT_FILE, out)

console.log("✅ Generado:", OUT_FILE)
console.log("   Claves incluidas:", CLAVES.filter((k) => !faltantes.includes(k)).join(", "))
if (faltantes.length) console.log("   ⚠️  Sin valor en .env.local (no incluidas):", faltantes.join(", "))
console.log("")
console.log("Para preparar una caja nueva:")
console.log("  1. Instalá la app normalmente en esa PC.")
console.log("  2. Copiá este archivo a %APPDATA%\\ar.kioscoelbarrio.pos\\config.env")
console.log("     (por USB u otro medio — este script no lo manda solo).")
console.log("  3. Abrí la app e iniciá sesión con Google — se vincula sola.")
