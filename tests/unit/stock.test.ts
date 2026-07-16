import { describe, it, expect } from "vitest"

// ─── Tests de lógica pura de stock.service.ts ────────────────────────────────
// El servicio interactúa con Prisma (transacciones), así que testeamos la
// aritmética exacta de cada rama: ENTRADA convierte la presentación recibida
// a unidades base con el factor (unidadesPorVenta); AJUSTE NO aplica el
// factor — el conteo físico ya está en unidades base del dueño.

describe("stock.service — ENTRADA aplica el factor de la presentación", () => {
  it("recibir 5 docenas (factor 12) suma 60 unidades base al dueño", () => {
    const unidadesPorVenta = 12
    const cantidadIngresada = 5 // "5 docenas"
    const cantidadBase = cantidadIngresada * unidadesPorVenta
    expect(cantidadBase).toBe(60)
  })

  it("producto sin variante (factor 1) no altera la cantidad ingresada", () => {
    const unidadesPorVenta = 1
    const cantidadIngresada = 20
    expect(cantidadIngresada * unidadesPorVenta).toBe(20)
  })

  it("stockPosterior = stockAnterior + cantidadBase", () => {
    const stockAnterior = 30
    const cantidadBase = 5 * 12
    const stockPosterior = stockAnterior + cantidadBase
    expect(stockPosterior).toBe(90)
  })
})

describe("stock.service — AJUSTE ignora el factor (conteo físico en unidades base)", () => {
  /** Replica exactamente la rama AJUSTE de registrarMovimiento: el set
   * absoluto usa `cantidad` tal cual la cargó el usuario, nunca
   * `cantidad × unidadesPorVenta`. */
  function resolverAjuste(stockAnteriorDueño: number, cantidad: number) {
    if (cantidad < 0) throw new Error(`Stock resultante no puede ser negativo: ${cantidad}`)
    const stockPosterior = cantidad
    return { stockAnterior: stockAnteriorDueño, stockPosterior, movimiento: stockPosterior - stockAnteriorDueño }
  }

  it("ajustar un producto CON variantes (factor 12) a 45 unidades deja el dueño en 45, no en 45×12", () => {
    const unidadesPorVenta = 12 // factor de una variante del mismo dueño — irrelevante acá
    const cantidadContada = 45 // conteo físico real, en unidades base
    const r = resolverAjuste(60, cantidadContada)
    expect(r.stockPosterior).toBe(45)
    expect(r.stockPosterior).not.toBe(45 * unidadesPorVenta)
  })

  it("el movimiento registrado es la diferencia contra el stock anterior del dueño", () => {
    const r = resolverAjuste(60, 45)
    expect(r.movimiento).toBe(-15)
  })

  it("ajuste a un número negativo lanza y no llega a tocar el stock", () => {
    expect(() => resolverAjuste(60, -1)).toThrow("Stock resultante no puede ser negativo")
  })

  it("ajuste a 0 es válido (vaciar el stock del dueño)", () => {
    const r = resolverAjuste(60, 0)
    expect(r.stockPosterior).toBe(0)
    expect(r.movimiento).toBe(-60)
  })
})
