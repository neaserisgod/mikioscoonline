import { describe, it, expect } from "vitest"
import {
  precioDesdeCosoYMarkup,
  costoDesdeePrecioYMarkup,
  markupBpDesdeCostoYPrecio,
  precioDesdeCosoYGananciaFija,
  costoDesdeePrecioYGananciaFija,
  gananciaBruta,
  resolverTriangulo,
} from "@/domain/markup"

describe("precioDesdeCosoYMarkup", () => {
  it("costo 1000 + markup 70% → precio 1700", () => {
    expect(precioDesdeCosoYMarkup(1000, 7000)).toBe(1700)
  })

  it("costo 1000 + markup 5% → precio 1050 redondeado para arriba al peso entero (1100)", () => {
    expect(precioDesdeCosoYMarkup(1000, 500)).toBe(1100)
  })

  it("costo 0 + markup 0% → precio 0", () => {
    expect(precioDesdeCosoYMarkup(0, 0)).toBe(0)
  })
})

describe("costoDesdeePrecioYMarkup", () => {
  it("precio 1700 + markup 70% → costo 1000", () => {
    expect(costoDesdeePrecioYMarkup(1700, 7000)).toBe(1000)
  })

  it("precio 1050 + markup 5% → costo 1000", () => {
    expect(costoDesdeePrecioYMarkup(1050, 500)).toBe(1000)
  })

  it("lanza error si markupBp ≤ -10000", () => {
    expect(() => costoDesdeePrecioYMarkup(1000, -10000)).toThrow()
  })
})

describe("markupBpDesdeCostoYPrecio", () => {
  it("costo 1000, precio 1700 → 7000 bp (70%)", () => {
    expect(markupBpDesdeCostoYPrecio(1000, 1700)).toBe(7000)
  })

  it("costo 1000, precio 1050 → 500 bp (5%)", () => {
    expect(markupBpDesdeCostoYPrecio(1000, 1050)).toBe(500)
  })

  it("lanza error si costo es 0", () => {
    expect(() => markupBpDesdeCostoYPrecio(0, 1000)).toThrow()
  })

  it("markup negativo cuando precio < costo", () => {
    expect(markupBpDesdeCostoYPrecio(1000, 800)).toBe(-2000)
  })
})

describe("gananciaBruta", () => {
  it("precio 1700, costo 1000, cantidad 3 → ganancia 2100", () => {
    expect(gananciaBruta(1700, 1000, 3)).toBe(2100)
  })

  it("precio = costo → ganancia 0", () => {
    expect(gananciaBruta(1000, 1000, 5)).toBe(0)
  })
})

describe("precioDesdeCosoYGananciaFija", () => {
  it("costo 1000 + ganancia 500 → precio 1500", () => {
    expect(precioDesdeCosoYGananciaFija(1000, 500)).toBe(1500)
  })

  it("ganancia negativa → precio < costo", () => {
    expect(precioDesdeCosoYGananciaFija(1000, -200)).toBe(800)
  })
})

describe("costoDesdeePrecioYGananciaFija", () => {
  it("precio 1500 + ganancia 500 → costo 1000", () => {
    expect(costoDesdeePrecioYGananciaFija(1500, 500)).toBe(1000)
  })

  it("ganancia mayor que precio → costo negativo", () => {
    expect(costoDesdeePrecioYGananciaFija(1000, 1500)).toBe(-500)
  })
})

describe("resolverTriangulo — modo PORCENTUAL (existente)", () => {
  const markupDefaultBp = 7000 // 70%

  it("costo + precio → calcula markup", () => {
    const r = resolverTriangulo({ costoCentavos: 1000, precioCentavos: 1700, markupDefaultBp })
    expect(r.costoCentavos).toBe(1000)
    expect(r.precioCentavos).toBe(1700)
    expect(r.markupBp).toBe(7000)
    expect(r.gananciaFijaCentavos).toBe(700)
    expect(r.costoEsProvisional).toBe(false)
    expect(r.margenNegativo).toBe(false)
  })

  it("costo + markup → calcula precio", () => {
    const r = resolverTriangulo({ costoCentavos: 1000, markupBp: 7000, markupDefaultBp })
    expect(r.precioCentavos).toBe(1700)
    expect(r.costoEsProvisional).toBe(false)
    expect(r.margenNegativo).toBe(false)
  })

  it("precio + markup → calcula costo", () => {
    const r = resolverTriangulo({ precioCentavos: 1700, markupBp: 7000, markupDefaultBp })
    expect(r.costoCentavos).toBe(1000)
    expect(r.costoEsProvisional).toBe(false)
  })

  it("solo precio + default PORCENTUAL → estima costo provisional", () => {
    const r = resolverTriangulo({ precioCentavos: 1700, markupDefaultBp: 7000 })
    expect(r.costoCentavos).toBe(1000)
    expect(r.costoEsProvisional).toBe(true)
    expect(r.margenNegativo).toBe(false)
  })

  it("lanza error sin datos suficientes", () => {
    expect(() => resolverTriangulo({ markupDefaultBp })).toThrow()
  })

  it("margen negativo — precio < costo, no tira error", () => {
    const r = resolverTriangulo({ costoCentavos: 1000, precioCentavos: 800, markupDefaultBp })
    expect(r.markupBp).toBe(-2000)
    expect(r.gananciaFijaCentavos).toBe(-200)
    expect(r.margenNegativo).toBe(true)
    expect(r.costoEsProvisional).toBe(false)
  })
})

describe("resolverTriangulo — modo FIJO", () => {
  const markupDefaultBp = 7000

  it("costo + gananciaFija → calcula precio", () => {
    const r = resolverTriangulo({ costoCentavos: 1000, gananciaFijaCentavos: 500, markupDefaultBp })
    expect(r.precioCentavos).toBe(1500)
    expect(r.gananciaFijaCentavos).toBe(500)
    expect(r.markupBp).toBe(5000)
    expect(r.costoEsProvisional).toBe(false)
    expect(r.margenNegativo).toBe(false)
  })

  it("precio + gananciaFija → calcula costo", () => {
    const r = resolverTriangulo({ precioCentavos: 1500, gananciaFijaCentavos: 500, markupDefaultBp })
    expect(r.costoCentavos).toBe(1000)
    expect(r.gananciaFijaCentavos).toBe(500)
    expect(r.costoEsProvisional).toBe(false)
    expect(r.margenNegativo).toBe(false)
  })

  it("solo precio + default FIJO → estima costo con gananciaFija default", () => {
    const r = resolverTriangulo({
      precioCentavos: 1500,
      markupDefaultBp,
      markupDefaultTipo: "FIJO",
      markupDefaultFijoCentavos: 500,
    })
    expect(r.costoCentavos).toBe(1000)
    expect(r.gananciaFijaCentavos).toBe(500)
    expect(r.costoEsProvisional).toBe(true)
    expect(r.margenNegativo).toBe(false)
  })

  it("solo precio + default PORCENTUAL (no FIJO) → estima costo porcentual, no fijo", () => {
    // default es PORCENTUAL 70%, precio 1700 → costo estimado 1000
    const r = resolverTriangulo({
      precioCentavos: 1700,
      markupDefaultBp: 7000,
      markupDefaultTipo: "PORCENTUAL",
      markupDefaultFijoCentavos: 500,  // ignorado porque tipo es PORCENTUAL
    })
    expect(r.costoCentavos).toBe(1000)
    expect(r.costoEsProvisional).toBe(true)
    expect(r.margenNegativo).toBe(false)
  })

  it("margen negativo en modo FIJO — gananciaFija negativa, no tira error", () => {
    const r = resolverTriangulo({ costoCentavos: 1000, gananciaFijaCentavos: -200, markupDefaultBp })
    expect(r.precioCentavos).toBe(800)
    expect(r.gananciaFijaCentavos).toBe(-200)
    expect(r.margenNegativo).toBe(true)
    expect(r.costoEsProvisional).toBe(false)
  })

  it("margen negativo detectado desde costo + precio en modo FIJO", () => {
    const r = resolverTriangulo({ costoCentavos: 2000, precioCentavos: 1800, markupDefaultBp })
    expect(r.gananciaFijaCentavos).toBe(-200)
    expect(r.margenNegativo).toBe(true)
  })
})
