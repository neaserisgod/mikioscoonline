import { describe, it, expect, vi, afterAll } from "vitest"
import { crearPrismaDeTest } from "../helpers/prisma-test"
import { crearEscenarioVentaBasico } from "../helpers/fixtures"

// Smoke de integración con Prisma real para venta.service.crear — no cambió
// como parte de C1-C4, pero producto.service.ts (que sí cambió, ver C2) y
// stock.service.ts son dependencias suyas indirectas, así que esto confirma
// que el flujo real de venta (transacción, descuento atómico de stock,
// idempotencia) sigue intacto.
const testPrisma = crearPrismaDeTest()
vi.mock("@/lib/prisma", () => ({ prisma: testPrisma }))
// Facturación/impresión corren fire-and-forget al final de crear() — se
// mockean para que este test no dependa de AFIP/impresora ni quede colgando
// llamadas de red reales en background.
vi.mock("@/services/facturacion.service", () => ({
  facturacionService: { facturarVenta: vi.fn().mockResolvedValue(undefined) },
}))
vi.mock("@/services/impresion.service", () => ({
  impresionService: { procesarTicketVenta: vi.fn().mockResolvedValue(undefined) },
}))

const { ventaService } = await import("@/services/venta.service")

describe("ventaService.crear — smoke de integración (sin regresión por los fixes de C1-C4)", () => {
  afterAll(async () => {
    await testPrisma.$disconnect()
  })

  it("crea la venta, descuenta stock atómicamente y registra el StockMovement", async () => {
    const { organization, user, medioEfectivo, producto } = await crearEscenarioVentaBasico(testPrisma, { stockProducto: 10 })

    const venta = await ventaService.crear({
      userId: user.id,
      organizationId: organization.id,
      lineas: [{ productId: producto.id, cantidad: 3 }],
      pagos: [{ paymentMethodId: medioEfectivo.id, montoCentavos: producto.precioCentavos * 3 }],
    })

    expect(venta.totalCentavos).toBe(producto.precioCentavos * 3)

    const productoActualizado = await testPrisma.product.findUniqueOrThrow({ where: { id: producto.id } })
    expect(productoActualizado.stock).toBe(7)

    const movimientos = await testPrisma.stockMovement.findMany({ where: { saleId: venta.id } })
    expect(movimientos).toHaveLength(1)
    expect(movimientos[0].tipo).toBe("SALIDA")
    expect(movimientos[0].stockAnterior).toBe(10)
    expect(movimientos[0].stockPosterior).toBe(7)
  })

  it("stock insuficiente: lanza y no descuenta nada (oversell sigue bloqueado)", async () => {
    const { organization, user, medioEfectivo, producto } = await crearEscenarioVentaBasico(testPrisma, { stockProducto: 2 })

    await expect(
      ventaService.crear({
        userId: user.id,
        organizationId: organization.id,
        lineas: [{ productId: producto.id, cantidad: 5 }],
        pagos: [{ paymentMethodId: medioEfectivo.id, montoCentavos: producto.precioCentavos * 5 }],
      })
    ).rejects.toThrow(/Stock insuficiente/)

    const productoActualizado = await testPrisma.product.findUniqueOrThrow({ where: { id: producto.id } })
    expect(productoActualizado.stock).toBe(2)
  })

  it("reintento idempotente con el mismo id no duplica stock ni venta", async () => {
    const { organization, user, medioEfectivo, producto } = await crearEscenarioVentaBasico(testPrisma, { stockProducto: 10 })
    const id = crypto.randomUUID()

    const input = {
      id,
      userId: user.id,
      organizationId: organization.id,
      lineas: [{ productId: producto.id, cantidad: 2 }],
      pagos: [{ paymentMethodId: medioEfectivo.id, montoCentavos: producto.precioCentavos * 2 }],
    }

    const primera = await ventaService.crear(input)
    const segunda = await ventaService.crear(input) // reintento con el mismo id (cola offline)

    expect(segunda.id).toBe(primera.id)
    const productoActualizado = await testPrisma.product.findUniqueOrThrow({ where: { id: producto.id } })
    expect(productoActualizado.stock).toBe(8) // descontado UNA sola vez, no dos
  })
})
