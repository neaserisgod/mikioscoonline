import crypto from "node:crypto"

/** Validación de firma compartida por todos los tópicos de notificaciones de MercadoPago. */
export function firmaValida(xSignature: string, xRequestId: string, dataId: string): boolean {
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

export function parseDataId(body: string): string | null {
  try {
    return JSON.parse(body || "{}")?.data?.id ?? null
  } catch {
    return null
  }
}

export function parseTopic(body: string): string | null {
  try {
    return JSON.parse(body || "{}")?.type ?? null
  } catch {
    return null
  }
}
