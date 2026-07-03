import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import { prisma } from "@/lib/prisma"

interface OrdenMp {
  transactions?: { payments?: Array<{ id?: string }> }
}
interface PagoMp {
  fee_details?: Array<{ amount?: number }>
}

/**
 * Webhook de MercadoPago (tópico "order", API de Orders unificada). No confirma
 * la venta en el POS — eso ya lo resuelve el polling de use-pago-qr-polling.ts.
 * Solo completa Payment.comisionRealCentavos en segundo plano, una vez que la
 * venta ya fue registrada con Payment.referencia = orderId.
 */
export async function POST(req: NextRequest) {
  const body = await req.text()
  const xSignature = req.headers.get("x-signature") ?? ""
  const xRequestId = req.headers.get("x-request-id") ?? ""
  const dataId = req.nextUrl.searchParams.get("data.id") ?? parseDataId(body)

  if (!dataId || !firmaValida(xSignature, xRequestId, dataId)) {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 })
  }

  try {
    await completarComisionReal(dataId)
  } catch {
    // Nunca relanzar: MP reintenta las notificaciones, y un 500 dispara backoff agresivo.
    // Si falla, comisionRealCentavos queda sin completar y se puede reconciliar a mano.
  }

  return NextResponse.json({ received: true })
}

function parseDataId(body: string): string | null {
  try {
    return JSON.parse(body || "{}")?.data?.id ?? null
  } catch {
    return null
  }
}

function firmaValida(xSignature: string, xRequestId: string, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) return false

  const parts = Object.fromEntries(
    xSignature
      .split(",")
      .map((p) => p.trim().split("=").map((s) => s.trim()))
      .filter((pair): pair is [string, string] => pair.length === 2)
  )
  if (!parts.ts || !parts.v1) return false

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${parts.ts};`
  const hash = crypto.createHmac("sha256", secret).update(manifest).digest("hex")
  return hash === parts.v1
}

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
