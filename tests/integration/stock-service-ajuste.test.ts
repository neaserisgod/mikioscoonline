import { describe, it, expect, vi, afterAll } from "vitest"
import { crearPrismaDeTest } from "../helpers/prisma-test"
import { crearOrganizacion, crearUsuario, crearCategoria, crearProducto } from "../helpers/fixtures"

// A7 — en la rama AJUSTE de productos pesables, gramosAnterior se leía del
// `producto` fetcheado ANTES de entrar al $transaction. Una venta concurrente
// entre esa lectura inicial y la transacción de AJUSTE dejaba un
// gramosAnterior/delta incorrecto en el StockMovement, y esa venta concurrente
// quedaba pisada por el SET absoluto del ajuste. Ahora gramosAnterior se relee
// DENTRO de la transacción.
const testPrisma = crearPrismaDeTest()
vi.mock("@/lib/prisma", () => ({ prisma: testPrisma }))

const { stockService } = await import("@/services/stock.service")

describe("stockService.registrarMovimiento — AJUSTE pesable no pierde una venta concurrente (A7)", () => {
  afterAll(async () => {
    await testPrisma.$disconnect()
  })

  it("una venta concurrente entre la lectura inicial y la transacción se refleja en gramosAnterior, no se pierde", async () => {
    const org = await crearOrganizacion(testPrisma)
    const user = await crearUsuario(testPrisma, org.id)
    const category = await crearCategoria(testPrisma, org.id)
    const producto = await crearProducto(testPrisma, org.id, category.id, { esPesable: true, stockGramos: 1000 })

    const originalFindFirstOrThrow = testPrisma.product.findFirstOrThrow.bind(testPrisma.product)
    const spy = vi
      .spyOn(testPrisma.product, "findFirstOrThrow")
      // @ts-expect-error — firma exacta de Prisma no importa acá, solo interceptar la única llamada
      .mockImplementationOnce(async (...args) => {
        const resultado = await originalFindFirstOrThrow(...args)
        // Simula una venta concurrente que descontó 300g justo después de la
        // lectura inicial de registrarMovimiento (la que solo chequea
        // esPesable), antes de que arranque la transacción de AJUSTE.
        await testPrisma.product.update({ where: { id: producto.id }, data: { stockGramos: 700 } })
        return resultado
      })

    const movimiento = await stockService.registrarMovimiento({
      productId: producto.id,
      userId: user.id,
      organizationId: org.id,
      tipo: "AJUSTE",
      cantidad: 500,
    })

    // Con el bug viejo, gramosAnterior hubiera sido 1000 (el valor stale de la
    // lectura inicial) — ahora refleja el valor real al momento del ajuste.
    expect(movimiento.gramosAnterior).toBe(700)
    expect(movimiento.gramosPosterior).toBe(500)
    expect(movimiento.gramos).toBe(500 - 700)

    const actualizado = await testPrisma.product.findUniqueOrThrow({ where: { id: producto.id } })
    expect(actualizado.stockGramos).toBe(500)

    spy.mockRestore()
  })

  it("AJUSTE normal (sin carrera): sigue funcionando igual que antes", async () => {
    const org = await crearOrganizacion(testPrisma)
    const user = await crearUsuario(testPrisma, org.id)
    const category = await crearCategoria(testPrisma, org.id)
    const producto = await crearProducto(testPrisma, org.id, category.id, { esPesable: true, stockGramos: 1000 })

    const movimiento = await stockService.registrarMovimiento({
      productId: producto.id,
      userId: user.id,
      organizationId: org.id,
      tipo: "AJUSTE",
      cantidad: 850,
    })

    expect(movimiento.gramosAnterior).toBe(1000)
    expect(movimiento.gramosPosterior).toBe(850)
  })
})
