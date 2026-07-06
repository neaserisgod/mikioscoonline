import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import { prisma } from "@/lib/prisma"
import { obtenerPreapproval } from "@/lib/mercadopago-suscripcion"
import type { EstadoPago } from "@prisma/client"

const ESTADO_MP_A_ESTADO_PAGO: Record<string, EstadoPago> = {
  authorized: "ACTIVO",
  paused: "VENCIDO",
  cancelled: "CANCELADO",
}

/**
 * Webhook de MercadoPago para el tópico de suscripciones (preapproval) — la
 * plata que el KIOSCO nos paga a nosotros por usar el SaaS, no confundir con
 * cobros/mp-webhook (la plata que el kiosco cobra a SUS clientes).
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
    await sincronizarEstado(dataId)
  } catch {
    // Nunca relanzar: MP reintenta las notificaciones, y un 500 dispara backoff agresivo.
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

/**
 * El checkout hospedado del plan no deja fijar external_reference de
 * antemano (no tokenizamos tarjeta nosotros, ver mercadopago-suscripcion.ts) —
 * identificamos la organización por el email con el que el usuario pagó,
 * que debe coincidir con el email con el que inició sesión en el sistema.
 */
async function sincronizarEstado(preapprovalId: string) {
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
