import { describe, it, expect } from "vitest"
import { calcularComision, totalComisiones } from "@/domain/comisiones"

describe("calcularComision", () => {
  it("efectivo (0 bp) → comision 0, neto = monto", () => {
    const r = calcularComision(10000, 0)
    expect(r.comisionCentavos).toBe(0)
    expect(r.montoNetoCentavos).toBe(10000)
  })

  it("MercadoPago 3.99% (399 bp) sobre $100,00 (10000 centavos)", () => {
    const r = calcularComision(10000, 399)
    // 10000 × 399 / 10000 = 399 centavos → $3,99
    expect(r.comisionCentavos).toBe(399)
    expect(r.montoNetoCentavos).toBe(9601)
  })

  it("débito 0.80% (80 bp) sobre $1.000,00 (100000 centavos)", () => {
    const r = calcularComision(100000, 80)
    expect(r.comisionCentavos).toBe(800)
    expect(r.montoNetoCentavos).toBe(99200)
  })

  it("comision + montoNeto siempre suman el monto original", () => {
    const monto = 13579
    const r = calcularComision(monto, 399)
    expect(r.comisionCentavos + r.montoNetoCentavos).toBe(monto)
  })

  it("lanza error si bp negativo", () => {
    expect(() => calcularComision(10000, -1)).toThrow()
  })
})

describe("totalComisiones", () => {
  it("suma comisiones de múltiples pagos", () => {
    const pagos = [
      { comisionCentavos: 399 },
      { comisionCentavos: 0 },
      { comisionCentavos: 800 },
    ]
    expect(totalComisiones(pagos)).toBe(1199)
  })

  it("lista vacía → 0", () => {
    expect(totalComisiones([])).toBe(0)
  })
})
