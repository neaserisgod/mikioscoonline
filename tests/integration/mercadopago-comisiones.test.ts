import { describe, it, expect, vi, afterAll, beforeEach } from "vitest"
import { crearPrismaDeTest } from "../helpers/prisma-test"
import { crearOrganizacion, crearUsuario, crearCategoria, crearCajaPrincipalAbierta, crearProducto } from "../helpers/fixtures"

// C1 — antes, si no existía ningún Payment local para una orden de MP, el
// webhook (vía completarComisionReal) hacía `return` en silencio: si el
// navegador se recargó/cerró con un cobro pendiente, la plata quedaba
// acreditada en MercadoPago sin ningún registro ni rastro. Ahora, si la orden
// está confirmada como pagada y no hay Payment local, primero se intenta
// recrear la venta de verdad a partir del snapshot que enviarMontoMpAction
// dejó en OrdenMpPendiente (backstop real, no solo una alerta) — y si no hay
// snapshot o la recreación falla, se cae al alerta fuerte de siempre.
const testPrisma = crearPrismaDeTest()
vi.mock("@/lib/prisma", () => ({ prisma: testPrisma }))

// completarComisionReal ahora importa ventaService de verdad (mismo prisma
// mockeado arriba) para el backstop — facturación/impresión son ruido para
// este archivo (se testean aparte), se mockean como no-op.
vi.mock("@/services/facturacion.service", () => ({
  facturacionService: { facturarVenta: vi.fn().mockResolvedValue(undefined) },
}))
vi.mock("@/services/impresion.service", () => ({
  impresionService: { procesarTicketVenta: vi.fn().mockResolvedValue(undefined) },
}))

const logErrorMock = vi.fn()
const logWarnMock = vi.fn()
vi.mock("@/lib/log", () => ({ logError: logErrorMock, logWarn: logWarnMock }))

const { completarComisionReal } = await import("@/lib/mercadopago-comisiones")

async function crearEscenarioMp() {
  const organization = await crearOrganizacion(testPrisma)
  const user = await crearUsuario(testPrisma, organization.id)
  const category = await crearCategoria(testPrisma, organization.id)
  await crearCajaPrincipalAbierta(testPrisma, organization.id, user.id)
  const medioQr = await testPrisma.paymentMethod.create({
    data: { nombre: "QR", esMercadoPago: true, organizationId: organization.id },
  })
  const producto = await crearProducto(testPrisma, organization.id, category.id, { stock: 10, precioCentavos: 100000 })
  return { organization, user, medioQr, producto }
}

function mockFetchOrdenPagada() {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("/v1/orders/")) {
      return { ok: true, json: async () => ({ status: "processed", transactions: { payments: [{ id: "pago-1", status: "approved" }] } }) }
    }
    return { ok: true, json: async () => ({ fee_details: [] }) }
  }))
}

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

  it("orden pagada SIN Payment pero CON snapshot: recrea la venta de verdad (backstop real, C1 residual)", async () => {
    const { organization, user, medioQr, producto } = await crearEscenarioMp()
    await testPrisma.ordenMpPendiente.create({
      data: {
        orderId: "orden-recuperable",
        organizationId: organization.id,
        medioPagoId: medioQr.id,
        userId: user.id,
        montoCentavos: 200000, // 2 unidades × $1000 (producto.precioCentavos)
        tipo: "qr",
        lineas: JSON.stringify([{ productId: producto.id, cantidad: 2 }]),
      },
    })
    mockFetchOrdenPagada()

    await completarComisionReal("orden-recuperable")

    // Se creó la venta de verdad: stock descontado, Payment con la referencia.
    const productoActualizado = await testPrisma.product.findUniqueOrThrow({ where: { id: producto.id } })
    expect(productoActualizado.stock).toBe(8)
    const payment = await testPrisma.payment.findFirst({ where: { referencia: "orden-recuperable" } })
    expect(payment).not.toBeNull()
    expect(payment?.montoCentavos).toBe(200000)

    // El snapshot ya no hace falta, y quedó un rastro (no silencioso) de que
    // esto pasó — pero NO es la alerta de "revisar manualmente".
    const snapshotRestante = await testPrisma.ordenMpPendiente.findUnique({ where: { orderId: "orden-recuperable" } })
    expect(snapshotRestante).toBeNull()
    expect(logWarnMock).toHaveBeenCalledTimes(1)
    expect(logWarnMock.mock.calls[0][0]).toBe("mp-webhook.orden-recuperada-automaticamente")
    expect(logErrorMock).not.toHaveBeenCalled()
  })

  it("orden pagada, snapshot existe pero ya no hay stock: cae al alerta fuerte (no se pierde en silencio)", async () => {
    const { organization, user, medioQr, producto } = await crearEscenarioMp()
    await testPrisma.product.update({ where: { id: producto.id }, data: { stock: 0 } }) // se vendió todo mientras tanto
    await testPrisma.ordenMpPendiente.create({
      data: {
        orderId: "orden-sin-stock",
        organizationId: organization.id,
        medioPagoId: medioQr.id,
        userId: user.id,
        montoCentavos: 200000, // 2 unidades × $1000 (producto.precioCentavos)
        tipo: "qr",
        lineas: JSON.stringify([{ productId: producto.id, cantidad: 2 }]),
      },
    })
    mockFetchOrdenPagada()

    await completarComisionReal("orden-sin-stock")

    // No se creó ninguna venta — pero tampoco se perdió en silencio.
    const payment = await testPrisma.payment.findFirst({ where: { referencia: "orden-sin-stock" } })
    expect(payment).toBeNull()
    expect(logErrorMock).toHaveBeenCalledTimes(2) // recuperación fallida + alerta genérica
    expect(logErrorMock.mock.calls[0][0]).toBe("mp-webhook.orden-pagada-sin-venta-recuperacion-fallida")
    expect(logErrorMock.mock.calls[1][0]).toBe("mp-webhook.orden-pagada-sin-venta")

    // El snapshot se mantiene (no se borra ante un fallo) por si sirve para
    // diagnosticar/reintentar a mano.
    const snapshotRestante = await testPrisma.ordenMpPendiente.findUnique({ where: { orderId: "orden-sin-stock" } })
    expect(snapshotRestante).not.toBeNull()
  })

  it("carrera con el polling client-side: si la venta YA existe (mismo id determinístico), no duplica ni revienta", async () => {
    const { organization, user, medioQr, producto } = await crearEscenarioMp()
    // Simula que use-pago-mp-polling.ts ya ganó la carrera y creó la venta con
    // el mismo id determinístico ANTES de que corra el backstop.
    const { ventaService } = await import("@/services/venta.service")
    await ventaService.crear({
      id: "mp-orden-ya-creada",
      userId: user.id,
      organizationId: organization.id,
      lineas: [{ productId: producto.id, cantidad: 1 }],
      pagos: [{ paymentMethodId: medioQr.id, montoCentavos: 100000, referencia: "orden-ya-creada" }],
    })
    await testPrisma.ordenMpPendiente.create({
      data: {
        orderId: "orden-ya-creada",
        organizationId: organization.id,
        medioPagoId: medioQr.id,
        userId: user.id,
        montoCentavos: 100000,
        tipo: "qr",
        lineas: JSON.stringify([{ productId: producto.id, cantidad: 1 }]),
      },
    })
    mockFetchOrdenPagada()

    await completarComisionReal("orden-ya-creada")

    // Idempotente: sigue habiendo UN solo Payment con esa referencia, no dos.
    const payments = await testPrisma.payment.findMany({ where: { referencia: "orden-ya-creada" } })
    expect(payments).toHaveLength(1)
    const productoActualizado = await testPrisma.product.findUniqueOrThrow({ where: { id: producto.id } })
    expect(productoActualizado.stock).toBe(9) // descontado UNA sola vez, no dos
    expect(logErrorMock).not.toHaveBeenCalled()
  })
})
