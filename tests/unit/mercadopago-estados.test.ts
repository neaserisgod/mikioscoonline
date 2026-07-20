import { describe, it, expect, vi, beforeEach } from "vitest"
import { MercadoPagoProvider } from "@/lib/providers/pagos/mercadopago"

// M3 — antes, un pago rechazado (tarjeta declinada) con la orden todavía
// "opened" no caía en pagado ni en finalizadoSinPago: el polling seguía
// esperando en silencio hasta el timeout de 5 min sin avisar al cajero que
// el cliente debía reintentar con otra tarjeta.

function mockFetchConOrden(body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => body })))
}

describe("MercadoPagoProvider.consultarEstadoOrdenQr — detección de rechazo (M3)", () => {
  const provider = new MercadoPagoProvider()

  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it("pago rechazado, orden sigue abierta: rechazado=true, pagado=false, finalizadoSinPago=false", async () => {
    mockFetchConOrden({
      status: "opened",
      external_reference: "org-1:uuid",
      transactions: { payments: [{ id: "p1", status: "rejected" }] },
    })

    const estado = await provider.consultarEstadoOrdenQr("orden-1")

    expect(estado.rechazado).toBe(true)
    expect(estado.pagado).toBe(false)
    expect(estado.finalizadoSinPago).toBe(false)
  })

  it("pago in_process (todavía procesando): no se marca como rechazado", async () => {
    mockFetchConOrden({
      status: "opened",
      transactions: { payments: [{ id: "p1", status: "in_process" }] },
    })

    const estado = await provider.consultarEstadoOrdenQr("orden-1")

    expect(estado.rechazado).toBe(false)
    expect(estado.pagado).toBe(false)
  })

  it("pago aprobado: pagado=true, rechazado=false (aunque hubiera habido un intento previo)", async () => {
    mockFetchConOrden({
      status: "processed",
      transactions: { payments: [{ id: "p1", status: "approved" }] },
    })

    const estado = await provider.consultarEstadoOrdenQr("orden-1")

    expect(estado.pagado).toBe(true)
    expect(estado.rechazado).toBe(false)
  })

  it("orden expirada tras un rechazo: finalizadoSinPago=true, rechazado=false (ya no aplica, se cancela igual)", async () => {
    mockFetchConOrden({
      status: "expired",
      transactions: { payments: [{ id: "p1", status: "rejected" }] },
    })

    const estado = await provider.consultarEstadoOrdenQr("orden-1")

    expect(estado.finalizadoSinPago).toBe(true)
    expect(estado.rechazado).toBe(false)
  })

  it("sin ningún pago todavía: rechazado=false", async () => {
    mockFetchConOrden({ status: "opened", transactions: { payments: [] } })

    const estado = await provider.consultarEstadoOrdenQr("orden-1")

    expect(estado.rechazado).toBe(false)
  })
})
