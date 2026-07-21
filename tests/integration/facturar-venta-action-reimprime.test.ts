import { describe, it, expect, vi, afterAll, beforeEach } from "vitest"
import { crearPrismaDeTest } from "../helpers/prisma-test"
import { crearOrganizacion, crearUsuario } from "../helpers/fixtures"

// Nueva funcionalidad: facturarVentaAction (el botón manual "Facturar" /
// "Reintentar" de /historial-ventas) ahora reimprime el ticket en la
// terminal, best-effort, DESPUÉS de una emisión exitosa. Esto es exclusivo
// de esta acción: facturacionService.facturarVenta en sí (usado también por
// el disparo automático de venta.service.ts y el cron afip-retry) no cambió
// — no reimprime nada, eso se probó aparte en facturacion-efectivo.test.ts.
const testPrisma = crearPrismaDeTest()
vi.mock("@/lib/prisma", () => ({ prisma: testPrisma }))

const authMock = vi.fn()
vi.mock("@/auth", () => ({ auth: authMock }))

const emitirMock = vi.fn()
vi.mock("@/lib/providers/facturacion", () => ({
  getFacturacionProvider: () => ({ emitir: emitirMock }),
}))

const imprimirMock = vi.fn()
vi.mock("@/lib/providers/impresion", () => ({
  getImpresionProvider: () => ({ imprimir: imprimirMock }),
}))

// El PDF (fiscal o del ticket) no es lo que este test cubre — mismo criterio
// que facturacion-efectivo.test.ts: better-sqlite3 no maneja bien columnas
// Bytes grandes en la DB de test, y facturacionService ya tolera un fallo de
// PDF sin que afecte el estado EMITIDO.
vi.mock("@/lib/pdf-ticket", () => ({ generarPdfTicket: vi.fn().mockRejectedValue(new Error("no probado acá")) }))

const logErrorMock = vi.fn()
vi.mock("@/lib/log", () => ({ logError: logErrorMock, logWarn: vi.fn() }))

const { facturarVentaAction } = await import("@/app/actions/facturacion.actions")

async function crearOrgFacturable() {
  const org = await crearOrganizacion(testPrisma)
  await testPrisma.organization.update({
    where: { id: org.id },
    data: { cuit: "20443236989", puntoDeVenta: 2, condicionIva: "MONOTRIBUTO" },
  })
  return org
}

async function crearVenta(organizationId: string, userId: string, paymentMethodId: string) {
  return testPrisma.sale.create({
    data: {
      userId,
      organizationId,
      totalCentavos: 100000,
      costoTotalCentavos: 50000,
      payments: {
        create: [{ paymentMethodId, montoCentavos: 100000, comisionCentavos: 0, montoNetoCentavos: 100000 }],
      },
    },
  })
}

describe("facturarVentaAction — reimprime el ticket tras una emisión exitosa", () => {
  beforeEach(() => {
    emitirMock.mockReset()
    imprimirMock.mockReset()
    authMock.mockReset()
  })

  afterAll(async () => {
    await testPrisma.$disconnect()
  })

  it("factura OK + hay terminal: reimprime y devuelve posnetEstado enviado", async () => {
    const org = await crearOrgFacturable()
    const user = await crearUsuario(testPrisma, org.id)
    authMock.mockResolvedValue({ user: { organizationId: org.id, role: "ADMIN" } })
    const qr = await testPrisma.paymentMethod.create({ data: { nombre: "QR", esEfectivo: false, organizationId: org.id } })
    await testPrisma.paymentMethod.create({
      data: { nombre: "Posnet", esMercadoPago: true, mpTerminalId: "TERM-1", activo: true, organizationId: org.id },
    })
    const venta = await crearVenta(org.id, user.id, qr.id)
    emitirMock.mockResolvedValue({ cae: "12345678901234", caeFechaVencimiento: new Date(), numeroComprobante: 1 })

    const result = await facturarVentaAction(venta.id)

    expect(result).toEqual({ ok: true, posnetEstado: "enviado" })
    expect(imprimirMock).toHaveBeenCalledTimes(1)
  })

  it("factura OK + sin terminal configurada: devuelve posnetEstado sin_terminal", async () => {
    const org = await crearOrgFacturable()
    const user = await crearUsuario(testPrisma, org.id)
    authMock.mockResolvedValue({ user: { organizationId: org.id, role: "ADMIN" } })
    const qr = await testPrisma.paymentMethod.create({ data: { nombre: "QR", esEfectivo: false, organizationId: org.id } })
    const venta = await crearVenta(org.id, user.id, qr.id)
    emitirMock.mockResolvedValue({ cae: "12345678901234", caeFechaVencimiento: new Date(), numeroComprobante: 1 })

    const result = await facturarVentaAction(venta.id)

    expect(result).toEqual({ ok: true, posnetEstado: "sin_terminal" })
    expect(imprimirMock).not.toHaveBeenCalled()
  })

  it("AFIP rechaza la emisión: NO reimprime (el Comprobante quedó en ERROR, no EMITIDO)", async () => {
    const org = await crearOrgFacturable()
    const user = await crearUsuario(testPrisma, org.id)
    authMock.mockResolvedValue({ user: { organizationId: org.id, role: "ADMIN" } })
    const qr = await testPrisma.paymentMethod.create({ data: { nombre: "QR", esEfectivo: false, organizationId: org.id } })
    await testPrisma.paymentMethod.create({
      data: { nombre: "Posnet", esMercadoPago: true, mpTerminalId: "TERM-1", activo: true, organizationId: org.id },
    })
    const venta = await crearVenta(org.id, user.id, qr.id)
    emitirMock.mockRejectedValue(new Error("Request failed with status code 400"))

    const result = await facturarVentaAction(venta.id)

    expect(result).toEqual({ ok: true })
    expect(imprimirMock).not.toHaveBeenCalled()
  })

  it("la impresión falla: la facturación sigue OK, solo cambia el posnetEstado (best-effort)", async () => {
    const org = await crearOrgFacturable()
    const user = await crearUsuario(testPrisma, org.id)
    authMock.mockResolvedValue({ user: { organizationId: org.id, role: "ADMIN" } })
    const qr = await testPrisma.paymentMethod.create({ data: { nombre: "QR", esEfectivo: false, organizationId: org.id } })
    await testPrisma.paymentMethod.create({
      data: { nombre: "Posnet", esMercadoPago: true, mpTerminalId: "TERM-1", activo: true, organizationId: org.id },
    })
    const venta = await crearVenta(org.id, user.id, qr.id)
    emitirMock.mockResolvedValue({ cae: "12345678901234", caeFechaVencimiento: new Date(), numeroComprobante: 1 })
    imprimirMock.mockRejectedValue(new Error("terminal desconectada"))

    const result = await facturarVentaAction(venta.id)

    expect(result).toEqual({ ok: true, posnetEstado: "error" })
    const comprobante = await testPrisma.comprobante.findUnique({ where: { saleId: venta.id } })
    expect(comprobante?.estado).toBe("EMITIDO")
  })

  it("venta 100% efectivo: no factura (regla existente) y por lo tanto tampoco reimprime", async () => {
    const org = await crearOrgFacturable()
    const user = await crearUsuario(testPrisma, org.id)
    authMock.mockResolvedValue({ user: { organizationId: org.id, role: "ADMIN" } })
    const efectivo = await testPrisma.paymentMethod.create({ data: { nombre: "Efectivo", esEfectivo: true, organizationId: org.id } })
    await testPrisma.paymentMethod.create({
      data: { nombre: "Posnet", esMercadoPago: true, mpTerminalId: "TERM-1", activo: true, organizationId: org.id },
    })
    const venta = await crearVenta(org.id, user.id, efectivo.id)

    const result = await facturarVentaAction(venta.id)

    expect(result).toEqual({ ok: true })
    expect(emitirMock).not.toHaveBeenCalled()
    expect(imprimirMock).not.toHaveBeenCalled()
  })
})
