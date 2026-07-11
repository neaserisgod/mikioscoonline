// Descarga inicial (y re-corrible) de los datos reales de Neon hacia una base
// SQLite local para el kiosco (kiosco.db por default). Filtra estrictamente
// por la organización del dueño — nunca toca datos de otros tenants del SaaS.
//
// Uso:
//   npx tsx scripts/kiosco-download-data.ts
//   KIOSCO_DB_PATH=kiosco-test.db npx tsx scripts/kiosco-download-data.ts   (prueba segura)
import { config } from "dotenv"
config()
config({ path: ".env.local", override: true })

import path from "node:path"
import { createPrismaClient } from "../src/lib/prisma-client-factory"
import { ORDEN_TABLAS, whereOrg, copiarTabla } from "./lib/kiosco-sync"

const OWNER_EMAIL = process.env.KIOSCO_OWNER_EMAIL ?? "gtalovergamer@gmail.com"
const dbPath = path.resolve(process.cwd(), process.env.KIOSCO_DB_PATH ?? "kiosco.db")

async function main() {
  const neonUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL
  if (!neonUrl || neonUrl.startsWith("file:")) {
    console.error("No hay una URL de Neon válida en NEON_DATABASE_URL/DATABASE_URL (.env.local). Abortando.")
    process.exit(1)
  }

  const neon = createPrismaClient(neonUrl)
  const local = createPrismaClient(`file:${dbPath.replace(/\\/g, "/")}`)

  console.log(`Descarga inicial: Neon → ${dbPath}`)

  const owner = await neon.user.findUnique({ where: { email: OWNER_EMAIL } })
  if (!owner) {
    console.error(`No existe ningún usuario con email ${OWNER_EMAIL} en Neon. Abortando.`)
    process.exit(1)
  }
  const organizationId = owner.organizationId
  console.log(`Organización resuelta: ${organizationId} (dueño: ${OWNER_EMAIL})\n`)

  const resumen: Record<string, number> = {}
  for (const modelo of ORDEN_TABLAS) {
    const where = whereOrg(modelo, organizationId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await copiarTabla(modelo, (neon as any)[modelo], (local as any)[modelo], where)
    resumen[modelo] = count
  }

  console.log("\n── Resumen ──")
  for (const [modelo, n] of Object.entries(resumen)) console.log(`  ${modelo}: ${n}`)
  console.log("\nRevisá que estos números sean razonables antes de confiar en el kiosco.")

  await neon.$disconnect()
  await local.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
