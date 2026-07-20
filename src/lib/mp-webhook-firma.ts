import crypto from "node:crypto"

// Margen generoso para el reintento normal de MP y el clock skew entre
// servidores, sin dejar la puerta abierta indefinidamente a una notificación
// vieja capturada y reenviada (replay) — la firma en sí (HMAC del manifest)
// no expira sola, MP recomienda validar también la frescura de `ts`.
const VENTANA_TS_MS = 5 * 60_000

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

  // `ts` es un Unix timestamp en SEGUNDOS (10 dígitos, ej. "1704908010" — no
  // milisegundos, confirmado contra el formato real que manda MP).
  const tsMs = Number(parts.ts) * 1000
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > VENTANA_TS_MS) return false

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
