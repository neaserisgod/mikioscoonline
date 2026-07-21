import { describe, it, expect, vi, afterAll, beforeEach } from "vitest"
import { crearPrismaDeTest } from "../helpers/prisma-test"
import { crearOrganizacion, crearUsuario, crearCategoria, crearProducto } from "../helpers/fixtures"

// Nueva funcionalidad: reimprimirTicket(saleId, organizationId) — reimpresión
// manual del ticket no fiscal desde /historial-ventas. A diferencia de
// procesarTicketVenta (que solo imprime si Organization.imprimirTicketPosnet
// está activo), esta es una acción a demanda del cajero: SIEMPRE intenta la
// terminal si hay una configurada, sin mirar ese toggle (mismo criterio que
// generarTicketPrueba).
const testPrisma = crearPrismaDeTest()
vi.mock("@/lib/prisma", () => ({ prisma: testPrisma }))

const imprimirMock = vi.fn()
vi.mock("@/lib/providers/impresion", () => ({
  getImpresionProvider: () => ({ imprimir: imprimirMock }),
}))

const logErrorMock = vi.fn()
vi.mock("@/lib/log", () => ({ logError: logErrorMock, logWarn: vi.fn() }))

const { impresionService } = await import("@/services/impresion.service")

async function crearEscenario(opts?: { imprimirTicketPosnet?: boolean }) {
  const organization = await crearOrganizacion(testPrisma)
  await testPrisma.organization.update({
    where: { id: organization.id },
    data: { imprimirTicketPosnet: opts?.imprimirTicketPosnet ?? false },
  })
  const user = await crearUsuario(testPrisma, organization.id)
  const category = await crearCategoria(testPrisma, organization.id)
  const producto = await crearProducto(testPrisma, organization.id, category.id)
  const sale = await testPrisma.sale.create({
    data: {
      userId: user.id,
      organizationId: organization.id,
      totalCentavos: 100000,
      costoTotalCentavos: 50000,
      lines: {
        create: [{ productId: producto.id, cantidad: 1, precioUnitarioCentavos: 100000, costoUnitarioCentavos: 50000 }],
      },
    },
  })
  return { organization, sale }
}

describe("impresionService.reimprimirTicket", () => {
  beforeEach(() => {
    imprimirMock.mockReset()
    logErrorMock.mockClear()
  })

  afterAll(async () => {
    await testPrisma.$disconnect()
  })

  it("hay una terminal activa: imprime y devuelve enviado", async () => {
    const { organization, sale } = await crearEscenario()
    await testPrisma.paymentMethod.create({
      data: { nombre: "Posnet", esMercadoPago: true, mpTerminalId: "TERM-1", activo: true, organizationId: organization.id },
    })
    imprimirMock.mockResolvedValue(undefined)

    const result = await impresionService.reimprimirTicket(sale.id, organization.id)

    expect(result).toEqual({ posnetEstado: "enviado" })
    expect(imprimirMock).toHaveBeenCalledTimes(1)
    expect(imprimirMock.mock.calls[0][0]).toBe("TERM-1")
  })

  it("no hay ninguna terminal configurada: devuelve sin_terminal sin llamar al provider", async () => {
    const { organization, sale } = await crearEscenario()

    const result = await impresionService.reimprimirTicket(sale.id, organization.id)

    expect(result).toEqual({ posnetEstado: "sin_terminal" })
    expect(imprimirMock).not.toHaveBeenCalled()
  })

  it("Organization.imprimirTicketPosnet en false: igual intenta la terminal (acción manual, no auto-print)", async () => {
    const { organization, sale } = await crearEscenario({ imprimirTicketPosnet: false })
    await testPrisma.paymentMethod.create({
      data: { nombre: "Posnet", esMercadoPago: true, mpTerminalId: "TERM-2", activo: true, organizationId: organization.id },
    })
    imprimirMock.mockResolvedValue(undefined)

    const result = await impresionService.reimprimirTicket(sale.id, organization.id)

    expect(result).toEqual({ posnetEstado: "enviado" })
    expect(imprimirMock).toHaveBeenCalledTimes(1)
  })

  it("el provider de impresión falla: devuelve error sin lanzar", async () => {
    const { organization, sale } = await crearEscenario()
    await testPrisma.paymentMethod.create({
      data: { nombre: "Posnet", esMercadoPago: true, mpTerminalId: "TERM-3", activo: true, organizationId: organization.id },
    })
    imprimirMock.mockRejectedValue(new Error("terminal desconectada"))

    const result = await impresionService.reimprimirTicket(sale.id, organization.id)

    expect(result).toEqual({ posnetEstado: "error" })
    expect(logErrorMock).toHaveBeenCalledTimes(1)
    expect(logErrorMock.mock.calls[0][0]).toBe("impresion.reimprimirTicket")
  })

  it("una terminal inactiva (activo:false) no cuenta: devuelve sin_terminal", async () => {
    const { organization, sale } = await crearEscenario()
    await testPrisma.paymentMethod.create({
      data: { nombre: "Posnet vieja", esMercadoPago: true, mpTerminalId: "TERM-4", activo: false, organizationId: organization.id },
    })

    const result = await impresionService.reimprimirTicket(sale.id, organization.id)

    expect(result).toEqual({ posnetEstado: "sin_terminal" })
    expect(imprimirMock).not.toHaveBeenCalled()
  })

  it("venta que no existe o es de otra organización: lanza (no es un fallo de impresión, no aplica el 'nunca lanza')", async () => {
    const { organization } = await crearEscenario()

    await expect(impresionService.reimprimirTicket("venta-inexistente", organization.id)).rejects.toThrow("Venta no encontrada")
  })
})
