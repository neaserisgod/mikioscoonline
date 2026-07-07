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

  // Comparación timing-safe — `===` corta en el primer byte distinto, lo que en teoría
  // permite forjar la firma midiendo tiempos de respuesta byte a byte.
  const hashBuf = Buffer.from(hash, "hex")
  const recibidoBuf = Buffer.from(parts.v1, "hex")
  if (hashBuf.length !== recibidoBuf.length) return false
  return crypto.timingSafeEqual(hashBuf, recibidoBuf)
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
