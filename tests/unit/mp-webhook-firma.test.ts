import { describe, it, expect, beforeEach, afterEach } from "vitest"
import crypto from "node:crypto"
import { firmaValida } from "@/lib/mp-webhook-firma"

// M2 — la firma HMAC en sí no expira sola: una notificación capturada (con
// firma válida) se podía reenviar indefinidamente. Ahora también se valida
// que `ts` esté dentro de una ventana razonable (5 min), como recomienda MP.

const SECRET = "secreto-de-test"

function firmarManifest(dataId: string, requestId: string, tsSegundos: number) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${tsSegundos};`
  const hash = crypto.createHmac("sha256", SECRET).update(manifest).digest("hex")
  return `ts=${tsSegundos},v1=${hash}`
}

describe("firmaValida — anti-replay (frescura de ts) + HMAC (M2)", () => {
  beforeEach(() => {
    process.env.MP_WEBHOOK_SECRET = SECRET
  })

  afterEach(() => {
    delete process.env.MP_WEBHOOK_SECRET
  })

  it("firma correcta con ts reciente: válida", () => {
    const ahoraSeg = Math.floor(Date.now() / 1000)
    const xSignature = firmarManifest("dato-1", "req-1", ahoraSeg)
    expect(firmaValida(xSignature, "req-1", "dato-1")).toBe(true)
  })

  it("firma correcta pero ts de hace 20 minutos (replay de una notificación vieja): inválida", () => {
    const viejoSeg = Math.floor(Date.now() / 1000) - 20 * 60
    const xSignature = firmarManifest("dato-1", "req-1", viejoSeg)
    expect(firmaValida(xSignature, "req-1", "dato-1")).toBe(false)
  })

  it("firma correcta con ts apenas dentro de la ventana (4 minutos atrás): válida", () => {
    const seg = Math.floor(Date.now() / 1000) - 4 * 60
    const xSignature = firmarManifest("dato-1", "req-1", seg)
    expect(firmaValida(xSignature, "req-1", "dato-1")).toBe(true)
  })

  it("ts en el futuro por clock skew moderado (2 minutos): válida", () => {
    const seg = Math.floor(Date.now() / 1000) + 2 * 60
    const xSignature = firmarManifest("dato-1", "req-1", seg)
    expect(firmaValida(xSignature, "req-1", "dato-1")).toBe(true)
  })

  it("HMAC inválido (secret distinto) aunque el ts sea fresco: inválida", () => {
    const ahoraSeg = Math.floor(Date.now() / 1000)
    const manifest = `id:dato-1;request-id:req-1;ts:${ahoraSeg};`
    const hashConOtroSecreto = crypto.createHmac("sha256", "otro-secreto").update(manifest).digest("hex")
    expect(firmaValida(`ts=${ahoraSeg},v1=${hashConOtroSecreto}`, "req-1", "dato-1")).toBe(false)
  })

  it("sin MP_WEBHOOK_SECRET configurado: inválida", () => {
    delete process.env.MP_WEBHOOK_SECRET
    const ahoraSeg = Math.floor(Date.now() / 1000)
    const xSignature = firmarManifest("dato-1", "req-1", ahoraSeg)
    expect(firmaValida(xSignature, "req-1", "dato-1")).toBe(false)
  })

  it("firma sin ts o sin v1: inválida", () => {
    expect(firmaValida("v1=abc", "req-1", "dato-1")).toBe(false)
    expect(firmaValida("ts=123", "req-1", "dato-1")).toBe(false)
    expect(firmaValida("", "req-1", "dato-1")).toBe(false)
  })

  it("ts no numérico: inválida, no revienta", () => {
    expect(firmaValida("ts=no-es-numero,v1=abc", "req-1", "dato-1")).toBe(false)
  })
})
