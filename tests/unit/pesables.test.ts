import { describe, it, expect } from "vitest"
import {
  precioUnitarioEfectivo,
  costoUnitarioEfectivo,
  subtotalLinea,
  stockDisponible,
  valoresInventario,
  gananciaPotencial,
} from "@/domain/pesables"

const noPesable = {
  esPesable: false,
  precioCentavos: 15000,
  costoCentavos: 10000,
  precioPorKgCentavos: null,
  costoPorKgCentavos: null,
}

const pesable = {
  esPesable: true,
  precioCentavos: 0,
  costoCentavos: 0,
  precioPorKgCentavos: 800000, // $8000/kg
  costoPorKgCentavos: 600000, // $6000/kg
}

describe("precio/costo unitario efectivo", () => {
  it("no pesable → usa precio/costo por unidad", () => {
    expect(precioUnitarioEfectivo(noPesable)).toBe(15000)
    expect(costoUnitarioEfectivo(noPesable)).toBe(10000)
  })

  it("pesable → usa precio/costo por kg", () => {
    expect(precioUnitarioEfectivo(pesable)).toBe(800000)
    expect(costoUnitarioEfectivo(pesable)).toBe(600000)
  })

  it("pesable sin precioPorKg configurado → lanza error (no corromper total)", () => {
    expect(() =>
      precioUnitarioEfectivo({ ...pesable, precioPorKgCentavos: null })
    ).toThrow()
    expect(() =>
      costoUnitarioEfectivo({ ...pesable, costoPorKgCentavos: null })
    ).toThrow()
  })
})

describe("subtotalLinea", () => {
  it("no pesable: precio × cantidad", () => {
    expect(
      subtotalLinea({ esPesable: false, precioUnitarioCentavos: 15000, cantidad: 3, gramos: null })
    ).toBe(45000)
  })

  it("pesable: precioPorKg × gramos / 1000", () => {
    // $8000/kg × 250g = $2000
    expect(
      subtotalLinea({ esPesable: true, precioUnitarioCentavos: 800000, cantidad: 1, gramos: 250 })
    ).toBe(200000)
  })

  it("pesable: redondea al centavo (banker-free Math.round)", () => {
    // 799900 × 333 / 1000 = 266366.7 → 266367
    expect(
      subtotalLinea({ esPesable: true, precioUnitarioCentavos: 799900, cantidad: 1, gramos: 333 })
    ).toBe(266367)
  })

  it("pesable sin gramos → 0 (no explota, gramos ?? 0)", () => {
    expect(
      subtotalLinea({ esPesable: true, precioUnitarioCentavos: 800000, cantidad: 1, gramos: null })
    ).toBe(0)
  })

  it("pesable ignora cantidad, no pesable ignora gramos", () => {
    // pesable: cantidad=99 no cambia nada, solo importan gramos
    expect(
      subtotalLinea({ esPesable: true, precioUnitarioCentavos: 800000, cantidad: 99, gramos: 250 })
    ).toBe(200000)
    // no pesable: gramos=99999 no cambia nada, solo importa cantidad
    expect(
      subtotalLinea({ esPesable: false, precioUnitarioCentavos: 15000, cantidad: 2, gramos: 99999 })
    ).toBe(30000)
  })
})

describe("stockDisponible", () => {
  it("no pesable → unidades", () => {
    expect(stockDisponible({ esPesable: false, stock: 12, stockGramos: null })).toBe(12)
  })
  it("pesable → gramos (0 si null)", () => {
    expect(stockDisponible({ esPesable: true, stock: 0, stockGramos: 3500 })).toBe(3500)
    expect(stockDisponible({ esPesable: true, stock: 0, stockGramos: null })).toBe(0)
  })
})

describe("valoresInventario / gananciaPotencial", () => {
  it("no pesable: valor venta y costo por stock, ganancia = diferencia", () => {
    const p = { ...noPesable, stock: 5, stockGramos: null }
    expect(valoresInventario(p)).toEqual({ valorVentaCentavos: 75000, valorCostoCentavos: 50000 })
    expect(gananciaPotencial(p)).toBe(25000)
  })

  it("pesable: valor sobre gramos en stock", () => {
    const p = { ...pesable, stock: 0, stockGramos: 500 }
    expect(valoresInventario(p)).toEqual({ valorVentaCentavos: 400000, valorCostoCentavos: 300000 })
    expect(gananciaPotencial(p)).toBe(100000)
  })
})
