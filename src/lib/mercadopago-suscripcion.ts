import { PRECIO_MENSUAL_CENTAVOS } from "@/lib/suscripcion"

const MP_API = "https://api.mercadopago.com"

interface PreapprovalMp {
  id: string
  status: string // "pending" | "authorized" | "paused" | "cancelled"
  external_reference?: string | null
  payer_email?: string | null
}

async function mpFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const detalle = body?.message ?? body?.error ?? res.statusText
    throw new Error(`MercadoPago API (${res.status}): ${detalle}`)
  }
  return body
}

/**
 * Setup de una única vez (no se llama en cada suscripción): crea el plan
 * compartido de $ referenciado por todas las organizaciones. El id resultante
 * se guarda en MP_PREAPPROVAL_PLAN_ID.
 */
export async function crearPreapprovalPlan(backUrl: string) {
  return mpFetch<{ id: string; init_point: string }>("/preapproval_plan", {
    method: "POST",
    body: JSON.stringify({
      reason: "Suscripción Kiosco",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: PRECIO_MENSUAL_CENTAVOS / 100,
        currency_id: "ARS",
      },
      back_url: backUrl,
    }),
  })
}

/**
 * Link al checkout hospedado por MercadoPago para el plan compartido. No se
 * crea la preapproval por API (eso exige card_token_id, o sea tokenizar la
 * tarjeta nosotros mismos) — en el checkout hospedado, MP arma la preapproval
 * sola una vez que el usuario completa el pago ahí, y nos avisa por webhook.
 */
export function urlCheckoutSuscripcion(): string {
  const planId = process.env.MP_PREAPPROVAL_PLAN_ID
  if (!planId) throw new Error("Falta MP_PREAPPROVAL_PLAN_ID")
  return `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=${planId}`
}

export async function obtenerPreapproval(id: string): Promise<PreapprovalMp> {
  return mpFetch<PreapprovalMp>(`/preapproval/${id}`, { method: "GET" })
}
