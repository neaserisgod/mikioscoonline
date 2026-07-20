import { describe, it, expect, vi, beforeEach } from "vitest"

// A1 — antes, consultarEstadoOrdenMpAction/cancelarOrdenMpAction solo
// verificaban que hubiera sesión, no que el orderId perteneciera a la
// organización de esa sesión. Cualquier usuario autenticado que conociera
// (o filtrara) el orderId de otra organización podía consultar o cancelar su
// orden. El external_reference (organizationId:uuid, ver pagos.actions.ts)
// es lo que ahora se usa para confirmar la pertenencia.

const authMock = vi.fn()
vi.mock("@/auth", () => ({ auth: authMock }))

const consultarEstadoOrdenQrMock = vi.fn()
const cancelarOrdenQrMock = vi.fn()
vi.mock("@/lib/providers/pagos", () => ({
  getPagosProvider: () => ({
    consultarEstadoOrdenQr: consultarEstadoOrdenQrMock,
    consultarEstadoOrdenPosnet: consultarEstadoOrdenQrMock,
    cancelarOrdenQr: cancelarOrdenQrMock,
    cancelarOrdenPosnet: cancelarOrdenQrMock,
  }),
}))

const { consultarEstadoOrdenMpAction, cancelarOrdenMpAction } = await import("@/app/actions/pagos.actions")

const ORG_PROPIA = "org-propia"
const ORG_AJENA = "org-ajena"

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { organizationId: ORG_PROPIA } })
})

describe("consultarEstadoOrdenMpAction — scoping por organización (A1)", () => {
  it("orden con external_reference de OTRA organización: No autorizado, no expone el estado", async () => {
    consultarEstadoOrdenQrMock.mockResolvedValue({
      pagado: true,
      finalizadoSinPago: false,
      externalReference: `${ORG_AJENA}:algun-uuid`,
    })

    const result = await consultarEstadoOrdenMpAction("orden-ajena", "qr")

    expect(result).toEqual({ ok: false, error: "No autorizado" })
  })

  it("orden con external_reference de la MISMA organización: devuelve el estado real", async () => {
    consultarEstadoOrdenQrMock.mockResolvedValue({
      pagado: true,
      finalizadoSinPago: false,
      externalReference: `${ORG_PROPIA}:algun-uuid`,
    })

    const result = await consultarEstadoOrdenMpAction("orden-propia", "qr")

    expect(result).toEqual({ ok: true, pagado: true, finalizadoSinPago: false })
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
      externalReference: `${ORG_AJENA}:algun-uuid`,
    })

    const result = await cancelarOrdenMpAction("orden-ajena", "qr")

    expect(result).toEqual({ ok: false, error: "No autorizado" })
    expect(cancelarOrdenQrMock).not.toHaveBeenCalled()
  })

  it("orden propia: cancela normalmente", async () => {
    consultarEstadoOrdenQrMock.mockResolvedValue({
      pagado: false,
      finalizadoSinPago: true,
      externalReference: `${ORG_PROPIA}:algun-uuid`,
    })
    cancelarOrdenQrMock.mockResolvedValue(undefined)

    const result = await cancelarOrdenMpAction("orden-propia", "qr")

    expect(result).toEqual({ ok: true })
    expect(cancelarOrdenQrMock).toHaveBeenCalledWith("orden-propia")
  })
})
