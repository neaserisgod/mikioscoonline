import { describe, it, expect } from "vitest"
import {
  parsearARS,
  redondearPesoArriba,
  floatACentavos,
  centavosAFloat,
  toMesAnio,
  parseFechaQuery,
} from "@/domain/dinero"

describe("parsearARS", () => {
  it("formato argentino con separador de miles y coma decimal", () => {
    expect(parsearARS("1.500,50")).toBe(150050)
  })
  it("acepta símbolo $ y espacios", () => {
    expect(parsearARS("$ 2.345,67")).toBe(234567)
  })
  it("entero sin decimales", () => {
    expect(parsearARS("1500")).toBe(150000)
  })
  it("formato con punto decimal (estilo inglés)", () => {
    expect(parsearARS("1500.50")).toBe(150050)
  })
  it("lanza error con texto no numérico", () => {
    expect(() => parsearARS("abc")).toThrow()
  })
})

describe("redondearPesoArriba", () => {
  it("redondea centavos hacia arriba al peso entero", () => {
    expect(redondearPesoArriba(150001)).toBe(150100)
    expect(redondearPesoArriba(150050)).toBe(150100)
  })
  it("un peso exacto no cambia", () => {
    expect(redondearPesoArriba(150000)).toBe(150000)
    expect(redondearPesoArriba(0)).toBe(0)
  })
  it("cualquier centavo sube al peso siguiente", () => {
    expect(redondearPesoArriba(1)).toBe(100)
  })
})

describe("float <-> centavos", () => {
  it("floatACentavos redondea", () => {
    expect(floatACentavos(15.005)).toBe(1501)
    expect(floatACentavos(15)).toBe(1500)
  })
  it("centavosAFloat divide por 100", () => {
    expect(centavosAFloat(150050)).toBe(1500.5)
  })
})

describe("toMesAnio", () => {
  it("formatea YYYY-MM con mes cero-padded", () => {
    expect(toMesAnio(new Date(2026, 0, 15))).toBe("2026-01")
    expect(toMesAnio(new Date(2026, 11, 1))).toBe("2026-12")
  })
})

describe("parseFechaQuery", () => {
  it("undefined cuando el param no vino (null de entrada)", () => {
    expect(parseFechaQuery(null)).toBeUndefined()
  })
  it("null cuando el string es inválido (el caller debe responder 400)", () => {
    expect(parseFechaQuery("no-es-fecha")).toBeNull()
  })
  it("YYYY-MM-DD se interpreta en horario local, no UTC", () => {
    const d = parseFechaQuery("2026-07-14") as Date
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(6) // julio
    expect(d.getDate()).toBe(14)
    expect(d.getHours()).toBe(0)
  })
})
