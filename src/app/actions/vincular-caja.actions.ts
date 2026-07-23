"use server"

import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { createPrismaClient } from "@/lib/prisma-client-factory"
import { ORDEN_TABLAS, whereOrg, copiarTabla } from "../../../scripts/lib/kiosco-sync"

type VincularResult = { ok: true } | { ok: false; error: string }

/**
 * Primera vez que se abre una caja nueva (0 ventas locales, ver el gate en
 * (dashboard)/layout.tsx): si el usuario inició sesión con Google y esa
 * cuenta ya tiene una organización real en producción — `resolverUsuarioGoogle`
 * la resuelve directo contra Neon vía `NEON_DATABASE_URL` (ver
 * src/lib/prisma-auth.ts), sin necesidad de tocar nada acá — esta action trae
 * los datos de esa organización a la SQLite local reusando la MISMA lógica
 * que ya usa `scripts/kiosco-download-data.ts` (mismo orden de tablas, mismo
 * filtro por organización, mismo upsert idempotente por id).
 *
 * IMPORTANTE: `Organization.id` de la plantilla local (`org_principal`,
 * sembrada por prisma/seed.ts) es el MISMO id que usa la organización real en
 * Neon — este código nació single-tenant y ese id quedó fijo desde entonces.
 * Incluso el email admin por default (`admin@kiosco.ar`) puede coincidir con
 * un usuario real. Por eso NO se puede distinguir "plantilla" de "real" por
 * id/email, y un upsert directo sin más chocaría contra `User.email @unique`.
 * En cambio: como el gate ya garantiza 0 ventas locales, es seguro BORRAR
 * primero todo lo que haya localmente bajo `org_principal` (nunca hubo nada
 * real ahí) y recién después importar limpio desde Neon.
 */
export async function vincularCajaAction(): Promise<VincularResult> {
  const session = await auth()
  if (!session?.user?.organizationId) return { ok: false, error: "No autorizado" }

  const organizationId = session.user.organizationId

  const neonUrl = process.env.NEON_DATABASE_URL
  if (!neonUrl) {
    return { ok: false, error: "Esta caja no tiene configurada la conexión a producción (NEON_DATABASE_URL)" }
  }

  // Re-chequeo defensivo del gate (por si se llega acá por otro camino o hubo
  // una venta entre el redirect y el click del botón): nunca borrar datos
  // reales de esta caja para "hacerle lugar" a la importación.
  const ventasLocales = await prisma.sale.count({ where: { organizationId } })
  if (ventasLocales > 0) {
    return { ok: false, error: "Esta caja ya tiene ventas registradas — no se puede vincular sin revisar antes" }
  }

  const neon = createPrismaClient(neonUrl)
  try {
    // Orden inverso para respetar FKs al borrar (mismo grafo que ORDEN_TABLAS,
    // solo dado vuelta).
    for (const tabla of [...ORDEN_TABLAS].reverse()) {
      if (tabla === "organization") continue // se pisa con upsert al importar, no hace falta borrarla
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any)[tabla].deleteMany({ where: whereOrg(tabla, organizationId) })
    }

    for (const tabla of ORDEN_TABLAS) {
      const where = whereOrg(tabla, organizationId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await copiarTabla(tabla, (neon as any)[tabla], (prisma as any)[tabla], where)
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudieron descargar los datos" }
  } finally {
    await neon.$disconnect()
  }

  redirect("/inicio")
}
