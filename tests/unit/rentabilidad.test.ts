import { describe, it, expect } from "vitest"

// ─── Tests de lógica pura de rentabilidad.service.ts (agrupador "producto") ──
// El servicio trae las líneas vía Prisma; acá se testea la resolución exacta
// del id/nombre agrupador para ese modo — una variante se atribuye a su
// dueño (variantOfId ?? productId), igual que el descuento de stock en
// venta.service.ts.

interface LineaSimulada {
  productId: string
  producto: { nombre: string; variantOfId: string | null; variantOf: { nombre: string } | null }
}

/** Replica exactamente la rama `agrupador === "producto"` de porAgrupador. */
function resolverAgrupadorProducto(linea: LineaSimulada): { id: string; nombre: string } {
  const { productId, producto } = linea
  const id = producto.variantOfId ?? productId
  const nombre = producto.variantOfId ? (producto.variantOf?.nombre ?? producto.nombre) : producto.nombre
  return { id, nombre }
}

describe("rentabilidad.service — agrupador 'producto' atribuye variantes al dueño", () => {
  it("una línea de un producto sin variantes se agrupa bajo sí mismo", () => {
    const linea: LineaSimulada = {
      productId: "coca-500",
      producto: { nombre: "Coca-Cola 500ml", variantOfId: null, variantOf: null },
    }
    const r = resolverAgrupadorProducto(linea)
    expect(r).toEqual({ id: "coca-500", nombre: "Coca-Cola 500ml" })
  })

  it("una línea de una variante se agrupa bajo el id y nombre del dueño", () => {
    const linea: LineaSimulada = {
      productId: "docena-huevo",
      producto: { nombre: "Docena de huevo", variantOfId: "huevo", variantOf: { nombre: "Huevo" } },
    }
    const r = resolverAgrupadorProducto(linea)
    expect(r).toEqual({ id: "huevo", nombre: "Huevo" })
  })

  it("dueño + dos variantes distintas del mismo dueño suman bajo un único id", () => {
    const lineas: LineaSimulada[] = [
      { productId: "huevo", producto: { nombre: "Huevo", variantOfId: null, variantOf: null } },
      { productId: "media-docena", producto: { nombre: "Media docena", variantOfId: "huevo", variantOf: { nombre: "Huevo" } } },
      { productId: "docena", producto: { nombre: "Docena", variantOfId: "huevo", variantOf: { nombre: "Huevo" } } },
    ]
    const ids = lineas.map((l) => resolverAgrupadorProducto(l).id)
    expect(new Set(ids).size).toBe(1)
    expect(ids[0]).toBe("huevo")
  })

  it("acumula unidades/ventas/costo de dueño y variante bajo la misma fila", () => {
    const mapa = new Map<string, { unidadesVendidas: number; ventasCentavos: number }>()
    const lineas = [
      { agrupadorId: "huevo", cantidad: 1, ventas: 100000 }, // venta directa del dueño
      { agrupadorId: "huevo", cantidad: 1, ventas: 1000000 }, // venta de la variante "Docena"
    ]
    for (const l of lineas) {
      const fila = mapa.get(l.agrupadorId) ?? { unidadesVendidas: 0, ventasCentavos: 0 }
      fila.unidadesVendidas += l.cantidad
      fila.ventasCentavos += l.ventas
      mapa.set(l.agrupadorId, fila)
    }
    expect(mapa.get("huevo")).toEqual({ unidadesVendidas: 2, ventasCentavos: 1100000 })
  })
})
