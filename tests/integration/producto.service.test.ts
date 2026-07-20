import { describe, it, expect, vi, afterAll } from "vitest"
import { crearPrismaDeTest } from "../helpers/prisma-test"
import { crearOrganizacion, crearUsuario, crearCategoria, crearProducto } from "../helpers/fixtures"

// C2 — antes, productoService.editar() pisaba `stock`/`stockGramos` con un SET
// absoluto sin auditoría cada vez que se editaba un producto (aunque el usuario
// solo hubiera querido cambiar el nombre), revirtiendo silenciosamente ventas
// concurrentes. Mockeamos "@/lib/prisma" ANTES de importar el servicio real:
// producto.service.ts y stock.service.ts importan el mismo singleton, así que
// este mock alcanza para ambos.
const testPrisma = crearPrismaDeTest()
vi.mock("@/lib/prisma", () => ({ prisma: testPrisma }))

const { productoService } = await import("@/services/producto.service")

describe("productoService.editar — no pisa stock salvo cambio explícito (C2)", () => {
  afterAll(async () => {
    await testPrisma.$disconnect()
  })

  it("editar sin tocar `stock` deja el stock intacto aunque haya cambiado por una venta mientras tanto", async () => {
    const org = await crearOrganizacion(testPrisma)
    const user = await crearUsuario(testPrisma, org.id)
    const category = await crearCategoria(testPrisma, org.id)
    const producto = await crearProducto(testPrisma, org.id, category.id, { stock: 10, nombre: "Coca-Cola 500ml" })

    // Simula una venta concurrente que descontó stock mientras el diálogo de
    // edición seguía abierto en el navegador con el valor viejo (10) cacheado.
    await testPrisma.product.update({ where: { id: producto.id }, data: { stock: 7 } })

    await productoService.editar({
      id: producto.id,
      organizationId: org.id,
      userId: user.id,
      nombre: "Coca-Cola 500ml (renombrado)",
      // stock: NO se manda — el usuario no tocó ese campo
    })

    const actualizado = await testPrisma.product.findUniqueOrThrow({ where: { id: producto.id } })
    expect(actualizado.nombre).toBe("Coca-Cola 500ml (renombrado)")
    expect(actualizado.stock).toBe(7) // la venta concurrente NO se revirtió
  })

  it("editar con `stock` explícito SÍ actualiza el stock y deja un StockMovement auditado (AJUSTE)", async () => {
    const org = await crearOrganizacion(testPrisma)
    const user = await crearUsuario(testPrisma, org.id)
    const category = await crearCategoria(testPrisma, org.id)
    const producto = await crearProducto(testPrisma, org.id, category.id, { stock: 10 })

    await productoService.editar({
      id: producto.id,
      organizationId: org.id,
      userId: user.id,
      stock: 25, // conteo físico real, el usuario sí tocó el campo
    })

    const actualizado = await testPrisma.product.findUniqueOrThrow({ where: { id: producto.id } })
    expect(actualizado.stock).toBe(25)

    const movimientos = await testPrisma.stockMovement.findMany({ where: { productId: producto.id } })
    expect(movimientos).toHaveLength(1)
    expect(movimientos[0].tipo).toBe("AJUSTE")
    expect(movimientos[0].stockAnterior).toBe(10)
    expect(movimientos[0].stockPosterior).toBe(25)
    expect(movimientos[0].userId).toBe(user.id)
  })

  it("editar con `stock` explícito pero sin userId lanza (no permite un ajuste sin auditoría)", async () => {
    const org = await crearOrganizacion(testPrisma)
    const category = await crearCategoria(testPrisma, org.id)
    const producto = await crearProducto(testPrisma, org.id, category.id, { stock: 10 })

    await expect(
      productoService.editar({ id: producto.id, organizationId: org.id, stock: 99 })
    ).rejects.toThrow(/userId/)

    const sinCambios = await testPrisma.product.findUniqueOrThrow({ where: { id: producto.id } })
    expect(sinCambios.stock).toBe(10)
  })

  it("editar pesable sin tocar `stockGramos` deja los gramos intactos", async () => {
    const org = await crearOrganizacion(testPrisma)
    const user = await crearUsuario(testPrisma, org.id)
    const category = await crearCategoria(testPrisma, org.id)
    const producto = await crearProducto(testPrisma, org.id, category.id, { esPesable: true, stockGramos: 5000 })

    await testPrisma.product.update({ where: { id: producto.id }, data: { stockGramos: 3200 } })

    await productoService.editar({
      id: producto.id,
      organizationId: org.id,
      userId: user.id,
      esPesable: true,
      nombre: "Fiambre (renombrado)",
    })

    const actualizado = await testPrisma.product.findUniqueOrThrow({ where: { id: producto.id } })
    expect(actualizado.stockGramos).toBe(3200)
  })
})
