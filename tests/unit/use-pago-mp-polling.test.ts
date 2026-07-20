import { describe, it, expect, vi, beforeEach } from "vitest"
import { useVentasStore } from "@/stores/ventas.store"

// C4 — antes, una excepción en el chequeo de un cobro pendiente (ej. un corte de
// red al consultar el estado de la orden) abortaba el `for` de poll() entero y
// el setTimeout que reprograma el próximo ciclo nunca se llegaba a llamar: el
// polling se moría en silencio para TODOS los cobros pendientes de todas las
// pestañas, sin ningún aviso, hasta recargar la página (lo cual, por el
// hallazgo C1, podía perder el cobro directamente). procesarCobroPendiente()
// ahora atrapa cualquier error y nunca lo relanza.

const crearVentaActionMock = vi.fn()
vi.mock("@/app/actions/ventas.actions", () => ({ crearVentaAction: crearVentaActionMock }))

const consultarEstadoOrdenMpActionMock = vi.fn()
const cancelarOrdenMpActionMock = vi.fn()
vi.mock("@/app/actions/pagos.actions", () => ({
  consultarEstadoOrdenMpAction: consultarEstadoOrdenMpActionMock,
  cancelarOrdenMpAction: cancelarOrdenMpActionMock,
}))

const toastMock = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
vi.mock("sonner", () => ({ toast: toastMock }))

const logErrorMock = vi.fn()
vi.mock("@/lib/log", () => ({ logError: logErrorMock, logWarn: vi.fn() }))

const { procesarCobroPendiente } = await import("@/components/pos/use-pago-mp-polling")

const qcMock = { invalidateQueries: vi.fn() } as unknown as Parameters<typeof procesarCobroPendiente>[1]

function ventaConCobroPendiente(overrides?: { iniciadoEn?: number }) {
  const ventaId = useVentasStore.getState().ventas[0].id
  const venta = {
    id: ventaId,
    label: "Venta 1",
    carrito: [
      {
        productId: "p1", nombre: "Test", sku: "sku1", cantidad: 1, gramos: null,
        esPesable: false, precioUnitarioCentavos: 1000, stock: 5, stockGramos: null,
        esCigarrillo: false, esCigarroSuelto: false,
      },
    ],
    medioPagoId: "medio-1",
    pagosSplit: null,
    descuentoPct: 0,
    esConsumoInterno: false,
    pagoMpPendiente: {
      tipo: "qr" as const, orderId: "orden-1", montoCentavos: 1000, descuentoCentavos: 0,
      iniciadoEn: overrides?.iniciadoEn ?? Date.now(),
    },
  }
  useVentasStore.setState({ ventas: [venta], ventaActivaId: ventaId })
  return venta
}

describe("procesarCobroPendiente — no frena el polling ante un error (C4)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("si consultarEstadoOrdenMpAction lanza: no propaga, loguea+avisa, y el cobro sigue pendiente para el próximo ciclo", async () => {
    consultarEstadoOrdenMpActionMock.mockRejectedValue(new Error("network down"))
    const venta = ventaConCobroPendiente()

    await expect(procesarCobroPendiente(venta, qcMock)).resolves.toBeUndefined()

    expect(logErrorMock).toHaveBeenCalledTimes(1)
    expect(logErrorMock.mock.calls[0][0]).toBe("use-pago-mp-polling")
    expect(toastMock.error).toHaveBeenCalledTimes(1)
    // No se tocó el estado del cobro — sigue pendiente para que el próximo ciclo reintente.
    expect(useVentasStore.getState().ventas[0].pagoMpPendiente).not.toBeNull()
    expect(cancelarOrdenMpActionMock).not.toHaveBeenCalled()
    expect(crearVentaActionMock).not.toHaveBeenCalled()
  })

  it("si crearVentaAction lanza (no devuelve {ok:false}, sino que rechaza): tampoco propaga", async () => {
    consultarEstadoOrdenMpActionMock.mockResolvedValue({ ok: true, pagado: true, finalizadoSinPago: false })
    crearVentaActionMock.mockRejectedValue(new Error("timeout de servidor"))
    const venta = ventaConCobroPendiente()

    await expect(procesarCobroPendiente(venta, qcMock)).resolves.toBeUndefined()

    expect(logErrorMock).toHaveBeenCalledTimes(1)
    expect(useVentasStore.getState().ventas[0].pagoMpPendiente).not.toBeNull()
  })

  it("camino feliz sin regresión: estado pagado crea la venta y limpia el cobro pendiente", async () => {
    consultarEstadoOrdenMpActionMock.mockResolvedValue({ ok: true, pagado: true, finalizadoSinPago: false })
    crearVentaActionMock.mockResolvedValue({ ok: true })
    const venta = ventaConCobroPendiente()

    await procesarCobroPendiente(venta, qcMock)

    expect(crearVentaActionMock).toHaveBeenCalledTimes(1)
    expect(useVentasStore.getState().ventas[0].pagoMpPendiente).toBeNull()
    expect(toastMock.success).toHaveBeenCalledTimes(1)
    expect(logErrorMock).not.toHaveBeenCalled()
  })

  it("timeout sin regresión: cancela la orden y limpia el cobro pendiente", async () => {
    cancelarOrdenMpActionMock.mockResolvedValue({ ok: true })
    const venta = ventaConCobroPendiente({ iniciadoEn: Date.now() - 10 * 60_000 })

    await procesarCobroPendiente(venta, qcMock)

    expect(cancelarOrdenMpActionMock).toHaveBeenCalledWith("orden-1", "qr")
    expect(useVentasStore.getState().ventas[0].pagoMpPendiente).toBeNull()
  })
})
