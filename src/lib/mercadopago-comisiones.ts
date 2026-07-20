import { prisma } from "@/lib/prisma"
import { ventaService, type LineaVentaInput } from "@/services/venta.service"
import { logError, logWarn } from "@/lib/log"

interface OrdenMp {
  status?: string
  external_reference?: string
  transactions?: { payments?: Array<{ id?: string; status?: string }> }
}
interface PagoMp {
  fee_details?: Array<{ amount?: number }>
}

/** Misma fórmula que use-pago-mp-polling.ts — si cambia, cambiarla en los dos
 * lugares (ver hallazgo C1 residual). */
function idVentaDesdeOrdenMp(orderId: string): string {
  return `mp-${orderId}`
}

/**
 * Si el pago se confirmó pero ningún Payment local existe todavía para esta
 * orden, es la señal de que el polling client-side (use-pago-mp-polling.ts)
 * nunca llegó a crear la venta (recarga de página, cierre de pestaña, crash
 * del navegador con el cobro pendiente). enviarMontoMpAction persiste un
 * snapshot del carrito en OrdenMpPendiente al crear la orden — si existe,
 * se usa para recrear la venta acá mismo en vez de solo alertar. El id
 * determinístico (idVentaDesdeOrdenMp) hace que esto sea seguro aunque
 * compita con el polling client-side: ventaService.crear es idempotente por
 * id (P2002), así que si ambos caminos llegan a intentarlo, el segundo
 * simplemente recibe la venta ya creada por el primero.
 */
async function intentarRecrearVenta(orderId: string): Promise<boolean> {
  const snapshot = await prisma.ordenMpPendiente.findUnique({ where: { orderId } })
  if (!snapshot) return false

  try {
    const lineas = JSON.parse(snapshot.lineas) as LineaVentaInput[]
    await ventaService.crear({
      id: idVentaDesdeOrdenMp(orderId),
      userId: snapshot.userId,
      organizationId: snapshot.organizationId,
      lineas,
      pagos: [{ paymentMethodId: snapshot.medioPagoId, montoCentavos: snapshot.montoCentavos, referencia: orderId }],
      descuentoCentavos: snapshot.descuentoCentavos,
    })
    await prisma.ordenMpPendiente.deleteMany({ where: { orderId } })
    logWarn(
      "mp-webhook.orden-recuperada-automaticamente",
      `Se recreó automáticamente la venta de la orden ${orderId}, que había quedado sin registrar (revisar que todo esté OK)`,
      { orderId, organizationId: snapshot.organizationId }
    )
    return true
  } catch (e) {
    // No se pudo recrear (ej. se quedó sin stock mientras tanto) — sigue al
    // alerta genérico de abajo, que ahora incluye el motivo del intento fallido.
    logError("mp-webhook.orden-pagada-sin-venta-recuperacion-fallida", e, {
      orderId,
      organizationId: snapshot.organizationId,
    })
    return false
  }
}

/**
 * Completa Payment.comisionRealCentavos a partir del id de orden de
 * MercadoPago — la llama tanto el webhook (apenas llega la notificación)
 * como el cron de reconciliación (para pagos cuyo webhook nunca llegó).
 */
export async function completarComisionReal(orderId: string) {
  const payment = await prisma.payment.findFirst({ where: { referencia: orderId } })
  if (payment?.comisionRealCentavos != null) return

  const orden = await mpGet<OrdenMp>(`/v1/orders/${orderId}`)
  const pagosOrden = orden?.transactions?.payments ?? []
  const estaPagada = orden?.status === "processed" || pagosOrden.some((p) => p.status === "approved")
  if (!estaPagada) return

  if (!payment) {
    const recreada = await intentarRecrearVenta(orderId)
    if (!recreada) {
      logError(
        "mp-webhook.orden-pagada-sin-venta",
        new Error("MercadoPago confirmó el pago de una orden que no tiene ninguna venta registrada — revisar manualmente"),
        { orderId, externalReference: orden?.external_reference }
      )
    }
    return
  }

  const paymentId = pagosOrden[0]?.id
  if (!paymentId) return

  const pago = await mpGet<PagoMp>(`/v1/payments/${paymentId}`)
  const comisionCentavos = Math.round(
    (pago?.fee_details ?? []).reduce((sum, f) => sum + (f.amount ?? 0), 0) * 100
  )

  await prisma.payment.update({
    where: { id: payment.id },
    data: { comisionRealCentavos: comisionCentavos },
  })
}

async function mpGet<T>(path: string): Promise<T | null> {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  })
  if (!res.ok) return null
  return res.json()
}
