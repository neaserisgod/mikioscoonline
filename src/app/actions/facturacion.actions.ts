"use server"

import { auth } from "@/auth"
import { facturacionService } from "@/services/facturacion.service"

type FacturarResult = { ok: true } | { ok: false; error: string }

/**
 * Emite (o reintenta) el comprobante de una venta. Misma acción sirve para
 * "Facturar" (venta sin comprobante todavía) y "Reintentar" (comprobante en
 * ERROR) — facturacionService.facturarVenta ya es idempotente en ambos casos.
 */
export async function facturarVentaAction(saleId: string): Promise<FacturarResult> {
  try {
    const session = await auth()
    if (!session?.user?.organizationId) return { ok: false, error: "No autorizado" }
    if (session.user.role !== "ADMIN") return { ok: false, error: "Solo ADMIN puede facturar una venta" }

    await facturacionService.facturarVenta(saleId, session.user.organizationId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo facturar la venta" }
  }
}
