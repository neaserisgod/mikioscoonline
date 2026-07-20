import { describe, it, expect, vi, afterAll, beforeEach } from "vitest"
import { crearPrismaDeTest } from "../helpers/prisma-test"
import { crearOrganizacion, crearUsuario } from "../helpers/fixtures"

// A4 — antes, el disparo AUTOMÁTICO de facturación (venta.service.ts) ya
// respetaba "efectivo nunca factura", pero el botón manual "Facturar" del
// historial de ventas llamaba a facturacionService.facturarVenta sin ese
// chequeo: un ADMIN podía forzar un CAE real (no anulable) para una venta
// 100% efectivo con un click.
const testPrisma = crearPrismaDeTest()
vi.mock("@/lib/prisma", () => ({ prisma: testPrisma }))

const emitirMock = vi.fn()
vi.mock("@/lib/providers/facturacion", () => ({
  getFacturacionProvider: () => ({ emitir: emitirMock }),
}))

// La generación de PDF no es lo que este test cubre (eso es A4 — el guard de
// "efectivo nunca factura" en el disparo manual) y el adapter de better-sqlite3
// de la DB de test no maneja bien columnas Bytes grandes — se mockea para que
// falle "limpio" (facturacion.service.ts ya tolera un fallo de PDF sin que
// afecte el estado EMITIDO, es el comportamiento existente, no algo de A4).
vi.mock("@/lib/pdf-ticket", () => ({ generarPdfTicket: vi.fn().mockRejectedValue(new Error("no probado acá")) }))

const { facturacionService } = await import("@/services/facturacion.service")

async function crearOrgFacturable(nombre?: string) {
  const org = await crearOrganizacion(testPrisma, { nombre })
  await testPrisma.organization.update({
    where: { id: org.id },
    data: { cuit: "20443236989", puntoDeVenta: 2, condicionIva: "MONOTRIBUTO" },
  })
  return org
}

async function crearMedioPago(organizationId: string, esEfectivo: boolean, nombre: string) {
  return testPrisma.paymentMethod.create({
    data: { nombre, esEfectivo, organizationId },
  })
}

async function crearVentaConPagos(
  organizationId: string,
  userId: string,
  medios: { paymentMethodId: string; montoCentavos: number }[]
) {
  return testPrisma.sale.create({
    data: {
      userId,
      organizationId,
      totalCentavos: medios.reduce((s, m) => s + m.montoCentavos, 0),
      costoTotalCentavos: 0,
      payments: {
        create: medios.map((m) => ({
          paymentMethodId: m.paymentMethodId,
          montoCentavos: m.montoCentavos,
          comisionCentavos: 0,
          montoNetoCentavos: m.montoCentavos,
        })),
      },
    },
  })
}

describe("facturacionService.facturarVenta — efectivo nunca factura, ni por el botón manual (A4)", () => {
  beforeEach(() => {
    emitirMock.mockReset()
  })

  afterAll(async () => {
    await testPrisma.$disconnect()
  })

  it("venta 100% efectivo: no llama a emitir() ni crea ningún Comprobante", async () => {
    const org = await crearOrgFacturable()
    const user = await crearUsuario(testPrisma, org.id)
    const efectivo = await crearMedioPago(org.id, true, "Efectivo")
    const venta = await crearVentaConPagos(org.id, user.id, [{ paymentMethodId: efectivo.id, montoCentavos: 100000 }])

    await facturacionService.facturarVenta(venta.id, org.id)

    expect(emitirMock).not.toHaveBeenCalled()
    const comprobante = await testPrisma.comprobante.findUnique({ where: { saleId: venta.id } })
    expect(comprobante).toBeNull()
  })

  it("venta mixta (efectivo + QR): SÍ dispara la facturación normal", async () => {
    const org = await crearOrgFacturable()
    const user = await crearUsuario(testPrisma, org.id)
    const efectivo = await crearMedioPago(org.id, true, "Efectivo")
    const qr = await crearMedioPago(org.id, false, "QR")
    const venta = await crearVentaConPagos(org.id, user.id, [
      { paymentMethodId: efectivo.id, montoCentavos: 50000 },
      { paymentMethodId: qr.id, montoCentavos: 50000 },
    ])
    emitirMock.mockResolvedValue({ cae: "12345678901234", caeFechaVencimiento: new Date(), numeroComprobante: 1 })

    await facturacionService.facturarVenta(venta.id, org.id)

    expect(emitirMock).toHaveBeenCalledTimes(1)
    const comprobante = await testPrisma.comprobante.findUnique({ where: { saleId: venta.id } })
    expect(comprobante?.estado).toBe("EMITIDO")
  })

  it("AFIP rechaza la emisión: el Comprobante en ERROR guarda el tipo/puntoVenta REALES, no los placeholders", async () => {
    const org = await crearOrgFacturable() // condicionIva MONOTRIBUTO, puntoDeVenta 2 → FACTURA_C, PDV 2
    const user = await crearUsuario(testPrisma, org.id)
    const qr = await crearMedioPago(org.id, false, "QR")
    const venta = await crearVentaConPagos(org.id, user.id, [{ paymentMethodId: qr.id, montoCentavos: 100000 }])
    emitirMock.mockRejectedValue(new Error("Request failed with status code 400"))

    await facturacionService.facturarVenta(venta.id, org.id)

    const comprobante = await testPrisma.comprobante.findUnique({ where: { saleId: venta.id } })
    expect(comprobante?.estado).toBe("ERROR")
    expect(comprobante?.tipo).toBe("FACTURA_C")
    expect(comprobante?.puntoVenta).toBe(2)
  })

  it("venta 100% QR (no efectivo): SÍ dispara la facturación normal", async () => {
    const org = await crearOrgFacturable()
    const user = await crearUsuario(testPrisma, org.id)
    const qr = await crearMedioPago(org.id, false, "QR")
    const venta = await crearVentaConPagos(org.id, user.id, [{ paymentMethodId: qr.id, montoCentavos: 100000 }])
    emitirMock.mockResolvedValue({ cae: "12345678901234", caeFechaVencimiento: new Date(), numeroComprobante: 1 })

    await facturacionService.facturarVenta(venta.id, org.id)

    expect(emitirMock).toHaveBeenCalledTimes(1)
  })
})
