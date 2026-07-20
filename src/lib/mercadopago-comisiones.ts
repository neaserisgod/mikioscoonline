import { prisma } from "@/lib/prisma"
import { logError } from "@/lib/log"

interface OrdenMp {
  status?: string
  external_reference?: string
  transactions?: { payments?: Array<{ id?: string; status?: string }> }
}
interface PagoMp {
  fee_details?: Array<{ amount?: number }>
}

/**
 * Completa Payment.comisionRealCentavos a partir del id de orden de
 * MercadoPago — la llama tanto el webhook (apenas llega la notificación)
 * como el cron de reconciliación (para pagos cuyo webhook nunca llegó). No
 * confirma la venta en el POS, eso lo resuelve el polling de
 * use-pago-mp-polling.ts — PERO si a esta altura (la orden ya está paga según
 * MP) no existe ningún Payment local, es la señal de que ese flujo nunca
 * llegó a crear la venta (recarga de página, cierre de pestaña, crash del
 * navegador con el cobro pendiente) y la plata quedó acreditada en
 * MercadoPago sin ningún registro acá. No hay forma de reconstruir la venta
 * desde acá (la orden no lleva el detalle del carrito — ver mercadopago.ts,
 * los ítems que se mandan a MP son solo el total, no el detalle real), así
 * que como backstop mínimo se deja un alerta fuerte y accionable en vez de
 * perderse en silencio (ver docs/REPORTE-NUCLEO.md, hallazgo C1).
 */
export async function completarComisionReal(orderId: string) {
  const payment = await prisma.payment.findFirst({ where: { referencia: orderId } })
  if (payment?.comisionRealCentavos != null) return

  const orden = await mpGet<OrdenMp>(`/v1/orders/${orderId}`)
  const pagosOrden = orden?.transactions?.payments ?? []
  const estaPagada = orden?.status === "processed" || pagosOrden.some((p) => p.status === "approved")
  if (!estaPagada) return

  if (!payment) {
    logError(
      "mp-webhook.orden-pagada-sin-venta",
      new Error("MercadoPago confirmó el pago de una orden que no tiene ninguna venta registrada — revisar manualmente"),
      { orderId, externalReference: orden?.external_reference }
    )
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
