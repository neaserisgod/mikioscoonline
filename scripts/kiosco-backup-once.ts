// Una corrida de backup: sube todo lo que haya en kiosco.db hacia Neon.
// Disparado por scripts/kiosco-backup-scheduler.mjs a las 21:55, o a mano:
//   npx tsx scripts/kiosco-backup-once.ts
import { config } from "dotenv"
config()
config({ path: ".env.local", override: true })

import path from "node:path"
import { createPrismaClient } from "../src/lib/prisma-client-factory"
import { ORDEN_TABLAS, MODELOS_CON_BORRADO, whereOrg, copiarTabla, borrarHuerfanos } from "./lib/kiosco-sync"

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

  const idsPorTabla: Record<string, string[]> = {}
  for (const modelo of ORDEN_TABLAS) {
    const where = whereOrg(modelo, organizationId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, ids } = await copiarTabla(modelo, (local as any)[modelo], (neon as any)[modelo], where)
    idsPorTabla[modelo] = ids
    void count
  }

  // Fase 2: borrado espejo, solo para los modelos con hard-delete real en la
  // app, y solo DESPUÉS de sincronizar Product (mismo guard de FK que ya
  // impidió el borrado local si hubiera productos asociados).
  console.log("\n── Borrado espejo ──")
  for (const modelo of MODELOS_CON_BORRADO) {
    const where = whereOrg(modelo, organizationId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await borrarHuerfanos(modelo, (neon as any)[modelo], where, idsPorTabla[modelo])
  }

  await local.$disconnect()
  await neon.$disconnect()
  console.log("\nBackup OK.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
