"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { facturacionService } from "@/services/facturacion.service"
import { impresionService } from "@/services/impresion.service"

type FacturarResult =
  | { ok: true; posnetEstado?: "enviado" | "sin_terminal" | "error" }
  | { ok: false; error: string }

/**
 * Emite (o reintenta) el comprobante de una venta. Misma acción sirve para
 * "Facturar" (venta sin comprobante todavía) y "Reintentar" (comprobante en
 * ERROR) — facturacionService.facturarVenta ya es idempotente en ambos casos.
 *
 * Además reimprime el ticket en la terminal tras una emisión exitosa —
 * best-effort, un fallo de impresión no debe hacer parecer que la
 * facturación (que sí ocurrió) falló. Esto es exclusivo de esta acción
 * manual: facturacionService.facturarVenta también la usan el disparo
 * automático (venta.service.ts) y el cron afip-retry, que NO deben
 * reimprimir, así que la reimpresión vive acá y no en el service.
 */
export async function facturarVentaAction(saleId: string): Promise<FacturarResult> {
  try {
    const session = await auth()
    if (!session?.user?.organizationId) return { ok: false, error: "No autorizado" }
    if (session.user.role !== "ADMIN") return { ok: false, error: "Solo ADMIN puede facturar una venta" }

    const organizationId = session.user.organizationId
    await facturacionService.facturarVenta(saleId, organizationId)

    // facturarVenta no devuelve si emitió o no (nunca lanza, deja el
    // Comprobante en ERROR si falló) — hay que releer el estado para saber
    // si corresponde reimprimir.
    const comprobante = await prisma.comprobante.findUnique({ where: { saleId }, select: { estado: true } })
    if (comprobante?.estado !== "EMITIDO") return { ok: true }

    try {
      const { posnetEstado } = await impresionService.reimprimirTicket(saleId, organizationId)
      return { ok: true, posnetEstado }
    } catch {
      return { ok: true }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo facturar la venta" }
  }
}
