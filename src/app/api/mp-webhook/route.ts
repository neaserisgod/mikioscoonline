import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { firmaValida, parseDataId, parseTopic } from "@/lib/mp-webhook-firma"
import { obtenerPreapproval } from "@/lib/mercadopago-suscripcion"
import type { EstadoPago } from "@prisma/client"

interface OrdenMp {
  transactions?: { payments?: Array<{ id?: string }> }
}
interface PagoMp {
  fee_details?: Array<{ amount?: number }>
}

const ESTADO_MP_A_ESTADO_PAGO: Record<string, EstadoPago> = {
  authorized: "ACTIVO",
  paused: "VENCIDO",
  cancelled: "CANCELADO",
}

/**
 * Único endpoint de notificaciones de MercadoPago para toda la app — MP solo
 * admite una URL de webhook por modo (prueba/productivo), no una por tópico,
 * así que acá despachamos según el "type" de la notificación:
 * - "subscription_preapproval": suscripción del SaaS (lo que el kiosco nos paga a nosotros)
 * - cualquier otro (pagos/orders del Checkout): cobro del kiosco a SU cliente (QR/posnet)
 */
export async function POST(req: NextRequest) {
  const body = await req.text()
  const xSignature = req.headers.get("x-signature") ?? ""
  const xRequestId = req.headers.get("x-request-id") ?? ""
  const dataId = req.nextUrl.searchParams.get("data.id") ?? parseDataId(body)
  const topic = req.nextUrl.searchParams.get("type") ?? parseTopic(body)

  if (!dataId || !firmaValida(xSignature, xRequestId, dataId)) {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 })
  }

  try {
    if (topic === "subscription_preapproval") {
      await sincronizarEstadoSuscripcion(dataId)
    } else {
      await completarComisionReal(dataId)
    }
  } catch {
    // Nunca relanzar: MP reintenta las notificaciones, y un 500 dispara backoff agresivo.
  }

  return NextResponse.json({ received: true })
}

// ─── Suscripción del SaaS ───────────────────────────────────────────────────

/**
 * El checkout hospedado del plan no deja fijar external_reference de
 * antemano (no tokenizamos tarjeta nosotros, ver mercadopago-suscripcion.ts) —
 * identificamos la organización por el email con el que el usuario pagó,
 * que debe coincidir con el email con el que inició sesión en el sistema.
 */
async function sincronizarEstadoSuscripcion(preapprovalId: string) {
  const preapproval = await obtenerPreapproval(preapprovalId)
  const estadoPago = ESTADO_MP_A_ESTADO_PAGO[preapproval.status]
  if (!estadoPago) return

  const organizationId =
    preapproval.external_reference ??
    (preapproval.payer_email
      ? (await prisma.user.findUnique({ where: { email: preapproval.payer_email } }))?.organizationId
      : null)
  if (!organizationId) return

  await prisma.organization.update({
    where: { id: organizationId },
    data: { estadoPago, mpPreapprovalId: preapproval.id },
  })
}

// ─── Cobros del kiosco a sus clientes (QR/posnet) ───────────────────────────

/** No confirma la venta en el POS — eso ya lo resuelve el polling de use-pago-qr-polling.ts.
 * Solo completa Payment.comisionRealCentavos en segundo plano. */
async function completarComisionReal(orderId: string) {
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
