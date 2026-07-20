import { describe, it, expect, vi, afterAll, beforeEach } from "vitest"
import { crearPrismaDeTest } from "../helpers/prisma-test"
import { crearOrganizacion } from "../helpers/fixtures"

// C1 — antes, si no existía ningún Payment local para una orden de MP, el
// webhook (vía completarComisionReal) hacía `return` en silencio: si el
// navegador se recargó/cerró con un cobro pendiente, la plata quedaba
// acreditada en MercadoPago sin ningún registro ni rastro. Ahora, si la orden
// está confirmada como pagada y no hay Payment local, debe quedar un alerta
// fuerte (logError con un scope distintivo) en vez de perderse en silencio.
const testPrisma = crearPrismaDeTest()
vi.mock("@/lib/prisma", () => ({ prisma: testPrisma }))

const logErrorMock = vi.fn()
vi.mock("@/lib/log", () => ({ logError: logErrorMock, logWarn: vi.fn() }))

const { completarComisionReal } = await import("@/lib/mercadopago-comisiones")

async function crearPaymentMethodMp(organizationId: string) {
  return testPrisma.paymentMethod.create({
    data: { nombre: "QR MercadoPago", esMercadoPago: true, organizationId },
  })
}

async function crearVentaConPago(organizationId: string, paymentMethodId: string, referencia: string | null, comisionRealCentavos: number | null) {
  const user = await testPrisma.user.create({ data: { nombre: "Cajero", organizationId } })
  const sale = await testPrisma.sale.create({
    data: {
      userId: user.id,
      organizationId,
      totalCentavos: 100000,
      costoTotalCentavos: 50000,
      payments: {
        create: [{ paymentMethodId, montoCentavos: 100000, comisionCentavos: 3990, montoNetoCentavos: 96010, referencia, comisionRealCentavos }],
      },
    },
    include: { payments: true },
  })
  return sale.payments[0]
}

describe("completarComisionReal — backstop de orden de MP paga sin venta (C1)", () => {
  beforeEach(() => {
    logErrorMock.mockClear()
    vi.unstubAllGlobals()
  })

  afterAll(async () => {
    await testPrisma.$disconnect()
  })

  it("orden pagada sin ningún Payment local: dispara logError con el scope de alerta, no revienta", async () => {
    const org = await crearOrganizacion(testPrisma)
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      expect(url).toContain("/v1/orders/orden-huerfana")
      return {
        ok: true,
        json: async () => ({
          status: "processed",
          external_reference: `${org.id}:algo`,
          transactions: { payments: [{ id: "pago-1", status: "approved" }] },
        }),
      }
    }))

    await completarComisionReal("orden-huerfana")

    expect(logErrorMock).toHaveBeenCalledTimes(1)
    expect(logErrorMock.mock.calls[0][0]).toBe("mp-webhook.orden-pagada-sin-venta")
    expect(logErrorMock.mock.calls[0][2]).toMatchObject({ orderId: "orden-huerfana", externalReference: `${org.id}:algo` })
  })

  it("orden todavía NO pagada sin Payment local: no alerta (no hay nada raro todavía)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: "opened", transactions: { payments: [] } }),
    })))

    await completarComisionReal("orden-pendiente")

    expect(logErrorMock).not.toHaveBeenCalled()
  })

  it("Payment local ya reconciliado (comisionRealCentavos != null): no llama a la red ni alerta", async () => {
    const org = await crearOrganizacion(testPrisma)
    const medio = await crearPaymentMethodMp(org.id)
    await crearVentaConPago(org.id, medio.id, "orden-ya-reconciliada", 500)

    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await completarComisionReal("orden-ya-reconciliada")

    expect(fetchMock).not.toHaveBeenCalled()
    expect(logErrorMock).not.toHaveBeenCalled()
  })

  it("Payment local sin reconciliar + orden pagada: completa comisionRealCentavos y NO alerta (caso normal)", async () => {
    const org = await crearOrganizacion(testPrisma)
    const medio = await crearPaymentMethodMp(org.id)
    const payment = await crearVentaConPago(org.id, medio.id, "orden-normal", null)

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/v1/orders/")) {
        return {
          ok: true,
          json: async () => ({ status: "processed", transactions: { payments: [{ id: "pago-99", status: "approved" }] } }),
        }
      }
      return { ok: true, json: async () => ({ fee_details: [{ amount: 39.9 }] }) }
    }))

    await completarComisionReal("orden-normal")

    const actualizado = await testPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } })
    expect(actualizado.comisionRealCentavos).toBe(3990)
    expect(logErrorMock).not.toHaveBeenCalled()
  })
})
