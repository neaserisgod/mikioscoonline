import { describe, it, expect } from "vitest"
import { calcularEquilibrio } from "@/domain/equilibrio"

describe("calcularEquilibrio", () => {
  it("cubierto: ganancia bruta > gastos fijos + comisiones", () => {
    const r = calcularEquilibrio({
      gastosFijosCentavos: 1_000_000,
      gananciaBrutaCentavos: 1_500_000,
      comisionesTotalesCentavos: 100_000,
    })
    // gananciaDisponible = 1.500.000 - 100.000 = 1.400.000 > 1.000.000
    expect(r.cubierto).toBe(true)
    expect(r.faltanteCentavos).toBe(0)
    expect(r.pctAvance).toBe(100)
    // gananciaNetaCentavos = 1.500.000 - 100.000 - 1.000.000 = 400.000
    expect(r.gananciaNetaCentavos).toBe(400_000)
  })

  it("no cubierto: ganancia bruta < gastos fijos", () => {
    const r = calcularEquilibrio({
      gastosFijosCentavos: 2_000_000,
      gananciaBrutaCentavos: 800_000,
      comisionesTotalesCentavos: 50_000,
    })
    // gananciaDisponible = 800.000 - 50.000 = 750.000 < 2.000.000
    expect(r.cubierto).toBe(false)
    expect(r.faltanteCentavos).toBe(1_250_000)
    expect(r.pctAvance).toBe(38) // Math.round(750000/2000000 * 100) = Math.round(37.5) = 38
    expect(r.gananciaNetaCentavos).toBe(-1_250_000)
  })

  it("exactamente cubierto: gananciaDisponible = gastosFijos", () => {
    const r = calcularEquilibrio({
      gastosFijosCentavos: 500_000,
      gananciaBrutaCentavos: 600_000,
      comisionesTotalesCentavos: 100_000,
    })
    expect(r.cubierto).toBe(true)
    expect(r.faltanteCentavos).toBe(0)
    expect(r.pctAvance).toBe(100)
    expect(r.gananciaNetaCentavos).toBe(0)
  })

  it("sin gastos fijos → siempre cubierto con pct 100", () => {
    const r = calcularEquilibrio({
      gastosFijosCentavos: 0,
      gananciaBrutaCentavos: 100_000,
      comisionesTotalesCentavos: 5_000,
    })
    expect(r.cubierto).toBe(true)
    expect(r.pctAvance).toBe(100)
    expect(r.faltanteCentavos).toBe(0)
  })

  it("sin ventas: 0% avance y faltante = gastos fijos", () => {
    const r = calcularEquilibrio({
      gastosFijosCentavos: 1_000_000,
      gananciaBrutaCentavos: 0,
      comisionesTotalesCentavos: 0,
    })
    expect(r.pctAvance).toBe(0)
    expect(r.faltanteCentavos).toBe(1_000_000)
    expect(r.gananciaNetaCentavos).toBe(-1_000_000)
  })
})

// Modelo financiero (ver docs/MODELO-FINANCIERO.md) — la "ganancia real del
// mes" tiene que descontar también monotributo y sueldo objetivo, no solo
// comisiones y gastos fijos. pctAvance/faltanteCentavos/cubierto quedan
// afuera a propósito: miden específicamente cobertura de gastos fijos.
describe("calcularEquilibrio — ganancia real del mes (monotributo + sueldo objetivo)", () => {
  it("ejemplo del doc: 900k bruto − 60k comisión − 250k gastos − 40k monotributo − 400k sueldo = 150k", () => {
    const r = calcularEquilibrio({
      gastosFijosCentavos: 250_000,
      gananciaBrutaCentavos: 900_000,
      comisionesTotalesCentavos: 60_000,
      monotributoCentavos: 40_000,
      sueldoObjetivoCentavos: 400_000,
    })
    expect(r.gananciaNetaCentavos).toBe(150_000)
  })

  it("sin monotributo/sueldo configurados (0 default) es idéntico a la fórmula vieja", () => {
    const base = { gastosFijosCentavos: 1_000_000, gananciaBrutaCentavos: 1_500_000, comisionesTotalesCentavos: 100_000 }
    const sinParametros = calcularEquilibrio(base)
    const conCero = calcularEquilibrio({ ...base, monotributoCentavos: 0, sueldoObjetivoCentavos: 0 })
    expect(conCero.gananciaNetaCentavos).toBe(sinParametros.gananciaNetaCentavos)
  })

  it("monotributo/sueldo NO afectan pctAvance, faltanteCentavos ni cubierto (solo gananciaNetaCentavos)", () => {
    const r = calcularEquilibrio({
      gastosFijosCentavos: 500_000,
      gananciaBrutaCentavos: 600_000,
      comisionesTotalesCentavos: 100_000,
      monotributoCentavos: 999_999,
      sueldoObjetivoCentavos: 999_999,
    })
    // Mismo resultado que el test "exactamente cubierto" de arriba, pese al
    // monotributo/sueldo enormes — esas dos métricas son sobre gastos fijos.
    expect(r.cubierto).toBe(true)
    expect(r.faltanteCentavos).toBe(0)
    expect(r.pctAvance).toBe(100)
    // Pero la ganancia real sí queda golpeada
    expect(r.gananciaNetaCentavos).toBe(0 - 999_999 - 999_999)
  })

  it("el negocio no se banca el sueldo objetivo todavía → ganancia real negativa", () => {
    const r = calcularEquilibrio({
      gastosFijosCentavos: 100_000,
      gananciaBrutaCentavos: 300_000,
      comisionesTotalesCentavos: 10_000,
      monotributoCentavos: 20_000,
      sueldoObjetivoCentavos: 400_000,
    })
    expect(r.gananciaNetaCentavos).toBeLessThan(0)
  })
})
