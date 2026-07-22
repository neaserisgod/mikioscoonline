import { describe, it, expect, vi, beforeEach } from "vitest"

// A1 — antes, consultarEstadoOrdenMpAction/cancelarOrdenMpAction solo
// verificaban que hubiera sesión, no que el orderId perteneciera a la
// organización de esa sesión. Cualquier usuario autenticado que conociera
// (o filtrara) el orderId de otra organización podía consultar o cancelar su
// orden. El external_reference (organizationId_uuid, ver pagos.actions.ts)
// es lo que ahora se usa para confirmar la pertenencia.

const authMock = vi.fn()
vi.mock("@/auth", () => ({ auth: authMock }))

const consultarEstadoOrdenQrMock = vi.fn()
const cancelarOrdenQrMock = vi.fn()
const enviarMontoAQrMock = vi.fn()
const enviarMontoAPosnetMock = vi.fn()
vi.mock("@/lib/providers/pagos", () => ({
  getPagosProvider: () => ({
    consultarEstadoOrdenQr: consultarEstadoOrdenQrMock,
    consultarEstadoOrdenPosnet: consultarEstadoOrdenQrMock,
    cancelarOrdenQr: cancelarOrdenQrMock,
    cancelarOrdenPosnet: cancelarOrdenQrMock,
    enviarMontoAQr: enviarMontoAQrMock,
    enviarMontoAPosnet: enviarMontoAPosnetMock,
  }),
}))

// cancelarOrdenMpAction también limpia el snapshot de C1 (OrdenMpPendiente) y
// enviarMontoMpAction lo crea — no es lo que testea A1 (los primeros dos
// describe de este archivo), se mockea como no-op ahí.
const ordenMpPendienteDeleteManyMock = vi.fn().mockResolvedValue({ count: 0 })
const ordenMpPendienteCreateMock = vi.fn().mockResolvedValue({})
const paymentMethodFindFirstMock = vi.fn()
vi.mock("@/lib/prisma", () => ({
  prisma: {
    ordenMpPendiente: { deleteMany: ordenMpPendienteDeleteManyMock, create: ordenMpPendienteCreateMock },
    paymentMethod: { findFirst: paymentMethodFindFirstMock },
  },
}))

const { consultarEstadoOrdenMpAction, cancelarOrdenMpAction, enviarMontoMpAction } = await import("@/app/actions/pagos.actions")

const ORG_PROPIA = "org-propia"
const ORG_AJENA = "org-ajena"

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { id: "user-1", organizationId: ORG_PROPIA } })
})

describe("consultarEstadoOrdenMpAction — scoping por organización (A1)", () => {
  it("orden con external_reference de OTRA organización: No autorizado, no expone el estado", async () => {
    consultarEstadoOrdenQrMock.mockResolvedValue({
      pagado: true,
      finalizadoSinPago: false,
      externalReference: `${ORG_AJENA}_algun-uuid`,
    })

    const result = await consultarEstadoOrdenMpAction("orden-ajena", "qr")

    expect(result).toEqual({ ok: false, error: "No autorizado" })
  })

  it("orden con external_reference de la MISMA organización: devuelve el estado real", async () => {
    consultarEstadoOrdenQrMock.mockResolvedValue({
      pagado: true,
      finalizadoSinPago: false,
      externalReference: `${ORG_PROPIA}_algun-uuid`,
    })

    const result = await consultarEstadoOrdenMpAction("orden-propia", "qr")

    expect(result).toEqual({ ok: true, pagado: true, finalizadoSinPago: false, rechazado: false })
  })

  it("orden propia con un intento rechazado: propaga rechazado=true (M3)", async () => {
    consultarEstadoOrdenQrMock.mockResolvedValue({
      pagado: false,
      finalizadoSinPago: false,
      rechazado: true,
      externalReference: `${ORG_PROPIA}_algun-uuid`,
    })

    const result = await consultarEstadoOrdenMpAction("orden-propia", "qr")

    expect(result).toEqual({ ok: true, pagado: false, finalizadoSinPago: false, rechazado: true })
  })

  it("orden sin external_reference (dato viejo/malformado): No autorizado por defecto, no explota", async () => {
    consultarEstadoOrdenQrMock.mockResolvedValue({ pagado: true, finalizadoSinPago: false })

    const result = await consultarEstadoOrdenMpAction("orden-sin-ref", "qr")

    expect(result).toEqual({ ok: false, error: "No autorizado" })
  })
})

describe("cancelarOrdenMpAction — scoping por organización (A1)", () => {
  it("orden de OTRA organización: No autorizado, y NUNCA llama a cancelar de verdad", async () => {
    consultarEstadoOrdenQrMock.mockResolvedValue({
      pagado: false,
      finalizadoSinPago: false,
      externalReference: `${ORG_AJENA}_algun-uuid`,
    })

    const result = await cancelarOrdenMpAction("orden-ajena", "qr")

    expect(result).toEqual({ ok: false, error: "No autorizado" })
    expect(cancelarOrdenQrMock).not.toHaveBeenCalled()
  })

  it("orden propia: cancela normalmente", async () => {
    consultarEstadoOrdenQrMock.mockResolvedValue({
      pagado: false,
      finalizadoSinPago: true,
      externalReference: `${ORG_PROPIA}_algun-uuid`,
    })
    cancelarOrdenQrMock.mockResolvedValue(undefined)

    const result = await cancelarOrdenMpAction("orden-propia", "qr")

    expect(result).toEqual({ ok: true })
    expect(cancelarOrdenQrMock).toHaveBeenCalledWith("orden-propia")
  })
})

describe("enviarMontoMpAction — persiste el snapshot para el backstop (C1 residual)", () => {
  it("QR con líneas: guarda OrdenMpPendiente con el snapshot completo", async () => {
    paymentMethodFindFirstMock.mockResolvedValue({ id: "medio-1", esMercadoPago: true, mpExternalPosId: "CAJA1" })
    enviarMontoAQrMock.mockResolvedValue({ orderId: "orden-nueva" })
    const lineas = [{ productId: "prod-1", cantidad: 2 }]

    const result = await enviarMontoMpAction("medio-1", 150000, lineas, 5000)

    expect(result).toEqual({ ok: true, orderId: "orden-nueva", tipo: "qr" })
    expect(ordenMpPendienteCreateMock).toHaveBeenCalledTimes(1)
    const data = ordenMpPendienteCreateMock.mock.calls[0][0].data
    expect(data).toMatchObject({
      orderId: "orden-nueva",
      organizationId: ORG_PROPIA,
      medioPagoId: "medio-1",
      userId: "user-1",
      montoCentavos: 150000,
      descuentoCentavos: 5000,
      tipo: "qr",
    })
    expect(JSON.parse(data.lineas)).toEqual(lineas)
  })

  it("posnet: mismo snapshot, tipo posnet", async () => {
    paymentMethodFindFirstMock.mockResolvedValue({ id: "medio-2", esMercadoPago: true, mpTerminalId: "TERM1" })
    enviarMontoAPosnetMock.mockResolvedValue({ orderId: "orden-posnet" })

    const result = await enviarMontoMpAction("medio-2", 90000, [{ productId: "prod-2", cantidad: 1 }])

    expect(result).toEqual({ ok: true, orderId: "orden-posnet", tipo: "posnet" })
    expect(ordenMpPendienteCreateMock).toHaveBeenCalledTimes(1)
    expect(ordenMpPendienteCreateMock.mock.calls[0][0].data.tipo).toBe("posnet")
  })

  it("sin líneas (llamador viejo): NO crea ningún snapshot, sigue funcionando", async () => {
    paymentMethodFindFirstMock.mockResolvedValue({ id: "medio-1", esMercadoPago: true, mpExternalPosId: "CAJA1" })
    enviarMontoAQrMock.mockResolvedValue({ orderId: "orden-sin-lineas" })

    const result = await enviarMontoMpAction("medio-1", 150000)

    expect(result).toEqual({ ok: true, orderId: "orden-sin-lineas", tipo: "qr" })
    expect(ordenMpPendienteCreateMock).not.toHaveBeenCalled()
  })

  it("medio de pago de otra organización: No autorizado, no llama a MP ni crea snapshot", async () => {
    paymentMethodFindFirstMock.mockResolvedValue(null) // findFirst ya scopea por organizationId

    const result = await enviarMontoMpAction("medio-ajeno", 150000, [{ productId: "prod-1", cantidad: 1 }])

    expect(result).toEqual({ ok: false, error: "Este medio de pago no es de MercadoPago" })
    expect(enviarMontoAQrMock).not.toHaveBeenCalled()
    expect(ordenMpPendienteCreateMock).not.toHaveBeenCalled()
  })
})
