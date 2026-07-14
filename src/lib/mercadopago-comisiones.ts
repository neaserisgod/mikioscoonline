import { prisma } from "@/lib/prisma"

interface OrdenMp {
  transactions?: { payments?: Array<{ id?: string }> }
}
interface PagoMp {
  fee_details?: Array<{ amount?: number }>
}

/**
 * Completa Payment.comisionRealCentavos a partir del id de orden de
 * MercadoPago — la llama tanto el webhook (apenas llega la notificación)
 * como el cron de reconciliación (para pagos cuyo webhook nunca llegó). No
 * confirma la venta en el POS, eso ya lo resuelve el polling de
 * use-pago-qr-polling.ts.
 */
export async function completarComisionReal(orderId: string) {
  const payment = await prisma.payment.findFirst({ where: { referencia: orderId } })
  if (!payment || payment.comisionRealCentavos != null) return

  const orden = await mpGet<OrdenMp>(`/v1/orders/${orderId}`)
  const paymentId = orden?.transactions?.payments?.[0]?.id
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
