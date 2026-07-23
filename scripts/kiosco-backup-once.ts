// Una corrida de backup: sube todo lo que haya en kiosco.db hacia Neon.
// Disparado por scripts/kiosco-backup-scheduler.mjs a las 21:55, o a mano:
//   npx tsx scripts/kiosco-backup-once.ts
import { config } from "dotenv"
config()
config({ path: ".env.local", override: true })

import path from "node:path"
import { createPrismaClient } from "../src/lib/prisma-client-factory"
import { subirCambiosLocales } from "./lib/kiosco-sync"

const dbPath = path.resolve(process.cwd(), process.env.KIOSCO_DB_PATH ?? "kiosco.db")

async function main() {
  const neonUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL
  if (!neonUrl || neonUrl.startsWith("file:")) {
    console.error("No hay una URL de Neon válida en NEON_DATABASE_URL/DATABASE_URL (.env.local). Abortando.")
    process.exit(1)
  }

  const local = createPrismaClient(`file:${dbPath.replace(/\\/g, "/")}`)
  const neon = createPrismaClient(neonUrl)

  // Chequeo de seguridad: kiosco.db debe tener exactamente 1 organización —
  // si tuviera 0 o varias, algo está mal con el archivo y no hay que
  // arriesgarse a pisar datos de Neon.
  const orgs = await local.organization.findMany({ select: { id: true } })
  if (orgs.length !== 1) {
    console.error(`kiosco.db tiene ${orgs.length} organización(es) (se esperaba 1). Abortando backup por seguridad.`)
    process.exit(1)
  }
  const organizationId = orgs[0].id
  console.log(`Backup: ${dbPath} → Neon (organización ${organizationId})\n`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await subirCambiosLocales(local as any, neon as any, organizationId)

  await local.$disconnect()
  await neon.$disconnect()
  console.log("\nBackup OK.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
