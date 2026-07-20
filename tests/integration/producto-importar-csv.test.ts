import { describe, it, expect, vi, afterAll } from "vitest"
import { crearPrismaDeTest } from "../helpers/prisma-test"
import { crearOrganizacion } from "../helpers/fixtures"

// M5 — importarCSV hacía cada operación (category/provider/location upsert,
// product create/update) fuera de cualquier transacción. Si algo fallaba a
// mitad de una fila (ej. resolverTriangulo tirando porque la fila no trae ni
// costo ni precio), la categoría ya podía haber quedado creada sin ningún
// producto usándola — el catálogo quedaba parcialmente aplicado para esa
// fila. Ahora cada fila es todo-o-nada en su propia transacción.
const testPrisma = crearPrismaDeTest()
vi.mock("@/lib/prisma", () => ({ prisma: testPrisma }))

const { productoService } = await import("@/services/producto.service")

describe("productoService.importarCSV — cada fila es atómica (M5)", () => {
  afterAll(async () => {
    await testPrisma.$disconnect()
  })

  it("fila sin costo ni precio: falla DESPUÉS de crear la categoría, pero la categoría no queda huérfana (rollback)", async () => {
    const org = await crearOrganizacion(testPrisma)
    const csv = "sku,nombre,categoria\nSKU-1,Producto sin precio,CategoriaNueva\n"

    const resultado = await productoService.importarCSV(csv, org.id)

    expect(resultado.creados).toBe(0)
    expect(resultado.errores).toHaveLength(1)
    expect(resultado.errores[0].error).toMatch(/Faltan datos/)

    // La categoría se hubiera creado ANTES del throw de resolverTriangulo —
    // con el fix, la transacción de la fila se revierte entera.
    const categoria = await testPrisma.category.findFirst({ where: { organizationId: org.id, nombre: "CategoriaNueva" } })
    expect(categoria).toBeNull()

    const producto = await testPrisma.product.findFirst({ where: { organizationId: org.id, sku: "SKU-1" } })
    expect(producto).toBeNull()
  })

  it("fila válida: crea categoría + producto normalmente (sin regresión)", async () => {
    const org = await crearOrganizacion(testPrisma)
    const csv = "sku,nombre,categoria,precio\nSKU-2,Producto OK,Bebidas,1000\n"

    const resultado = await productoService.importarCSV(csv, org.id)

    expect(resultado.creados).toBe(1)
    expect(resultado.errores).toHaveLength(0)

    const producto = await testPrisma.product.findFirst({ where: { organizationId: org.id, sku: "SKU-2" } })
    expect(producto).not.toBeNull()
    expect(producto?.precioCentavos).toBe(100000)

    const categoria = await testPrisma.category.findFirst({ where: { organizationId: org.id, nombre: "Bebidas" } })
    expect(categoria).not.toBeNull()
  })

  it("CSV mixto: la fila mala no afecta a la fila buena, ni dentro de la misma transacción del import", async () => {
    const org = await crearOrganizacion(testPrisma)
    const csv = [
      "sku,nombre,categoria,precio",
      "SKU-3,Producto malo,CategoriaMala,", // columna precio vacía (sin costo ni precio) → falla en resolverTriangulo
      "SKU-4,Producto bueno,CategoriaBuena,500",
    ].join("\n")

    const resultado = await productoService.importarCSV(csv, org.id)

    expect(resultado.creados).toBe(1)
    expect(resultado.errores).toHaveLength(1)

    const malo = await testPrisma.product.findFirst({ where: { organizationId: org.id, sku: "SKU-3" } })
    const bueno = await testPrisma.product.findFirst({ where: { organizationId: org.id, sku: "SKU-4" } })
    expect(malo).toBeNull()
    expect(bueno).not.toBeNull()

    const categoriaMala = await testPrisma.category.findFirst({ where: { organizationId: org.id, nombre: "CategoriaMala" } })
    expect(categoriaMala).toBeNull()
  })

  it("actualizar un producto existente vía CSV: sigue funcionando (sin regresión)", async () => {
    const org = await crearOrganizacion(testPrisma)
    await productoService.importarCSV("sku,nombre,categoria,precio\nSKU-5,Nombre viejo,Cat,1000\n", org.id)

    const resultado = await productoService.importarCSV("sku,nombre,categoria,precio\nSKU-5,Nombre nuevo,Cat,2000\n", org.id)

    expect(resultado.actualizados).toBe(1)
    expect(resultado.creados).toBe(0)
    const producto = await testPrisma.product.findFirst({ where: { organizationId: org.id, sku: "SKU-5" } })
    expect(producto?.nombre).toBe("Nombre nuevo")
    expect(producto?.precioCentavos).toBe(200000)
  })
})
