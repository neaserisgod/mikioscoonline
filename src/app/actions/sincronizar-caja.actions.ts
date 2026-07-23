"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { createPrismaClient } from "@/lib/prisma-client-factory"
import { subirCambiosLocales, bajarCambiosDeNeon } from "../../../scripts/lib/kiosco-sync"

type SincronizarResult =
  | { ok: true; subidos: Record<string, number>; bajados: Record<string, number> }
  | { ok: false; error: string }

/**
 * Botón "Sincronizar con la nube" (Config → Datos), solo visible/usable en una
 * caja kiosco con NEON_DATABASE_URL configurada. A diferencia de
 * `vincularCajaAction` (que borra todo lo local y reimporta, solo seguro con 0
 * ventas), esta action es no destructiva y pensada para re-correr en una caja
 * ya en uso: primero sube lo local a Neon (mismo upsert idempotente + borrado
 * espejo que ya usa el backup nocturno) y después baja de Neon el catálogo
 * (organización/usuarios/cajas/categorías/proveedores/ubicaciones/clientes/
 * medios de pago/gastos fijos/productos), sin borrar nada y sin pisar en
 * filas ya existentes los campos operativos que cambian localmente (stock,
 * saldos de cuenta corriente, contadores de login, etc. — ver
 * CAMPOS_SOLO_EN_CREACION en scripts/lib/kiosco-sync.ts). Ventas, pagos y
 * movimientos de caja nunca se tocan en la bajada.
 */
export async function sincronizarCajaAction(): Promise<SincronizarResult> {
  const session = await auth()
  if (!session?.user?.organizationId) return { ok: false, error: "No autorizado" }
  if (session.user.role !== "ADMIN") return { ok: false, error: "Solo ADMIN puede sincronizar" }

  const organizationId = session.user.organizationId

  const neonUrl = process.env.NEON_DATABASE_URL
  if (!neonUrl) {
    return { ok: false, error: "Esta caja no tiene configurada la conexión a producción (NEON_DATABASE_URL)" }
  }

  const neon = createPrismaClient(neonUrl)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subidos = await subirCambiosLocales(prisma as any, neon as any, organizationId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bajados = await bajarCambiosDeNeon(neon as any, prisma as any, organizationId)
    return { ok: true, subidos, bajados }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo sincronizar" }
  } finally {
    await neon.$disconnect()
  }
}
