// Genera el SQL para llevar las cajas YA INSTALADAS (con dev-template.db
// viejo) al schema.dev.prisma actual — ver aplicar_migraciones_sqlite en
// src-tauri/src/lib.rs, que aplica estos archivos en orden al arrancar.
//
// IMPORTANTE: correr esto ANTES de actualizar src-tauri/resources/dev-template.db
// al nuevo schema (con `db push` o el flujo que uses) — el diff necesita que
// dev-template.db todavía represente el schema VIEJO (el que ya tienen las
// cajas instaladas). Si ya lo actualizaste, restaurá una copia vieja del
// archivo primero (git show/checkout de una revisión anterior).
//
// Uso: node scripts/gen-migracion-sqlite.mjs <slug-corto-en-kebab-case>
import { execSync } from "node:child_process"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

const slug = process.argv[2]
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error("Uso: node scripts/gen-migracion-sqlite.mjs <slug-corto-en-kebab-case>")
  process.exit(1)
}

const TEMPLATE_DB = "src-tauri/resources/dev-template.db"
if (!existsSync(TEMPLATE_DB)) {
  console.error(`No existe ${TEMPLATE_DB} — no se puede calcular el diff.`)
  process.exit(1)
}

const dir = "src-tauri/resources/migraciones-sqlite"
mkdirSync(dir, { recursive: true })

const timestamp = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\.\d+Z$/, "")
  .replace("T", "")
const archivo = path.join(dir, `${timestamp}_${slug}.sql`)

console.log(`Calculando diff: ${TEMPLATE_DB} → prisma/schema.dev.prisma ...`)

const sql = execSync(
  "npx prisma migrate diff --from-config-datasource --to-schema=prisma/schema.dev.prisma --script",
  {
    env: {
      ...process.env,
      DATABASE_URL: `file:./${TEMPLATE_DB}`,
      LOCAL_DEV: "1",
      DOTENV_CONFIG_QUIET: "true", // sin esto, el tip de dotenv contamina el stdout capturado
    },
    encoding: "utf8",
  }
)

if (sql.includes("-- This is an empty migration.")) {
  console.log("El schema.dev.prisma actual ya coincide con dev-template.db — no hay nada que generar.")
  process.exit(0)
}

writeFileSync(archivo, sql)
console.log(`\nGenerado: ${archivo}`)
console.log("\nPróximos pasos:")
console.log("  1. Revisá el SQL generado antes de confiar en él.")
console.log(`  2. Recién después, actualizá ${TEMPLATE_DB} al nuevo schema (prisma db push contra ese archivo).`)
console.log("  3. Commiteá el .sql nuevo junto con el dev-template.db actualizado.")
