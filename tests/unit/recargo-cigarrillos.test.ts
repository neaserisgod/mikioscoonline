import { describe, it, expect } from "vitest"
import { calcularRecargoCigarrillos, type ItemCigarrillo } from "@/domain/recargo-cigarrillos"

// Montos definidos en el módulo:
//   primer atado     = 30000 ($300)
//   atado adicional  = 10000 ($100)
//   cigarro suelto   =  5000 ($50) por unidad

const atado = (cantidad: number): ItemCigarrillo => ({ esCigarrillo: true, esCigarroSuelto: false, cantidad })
const suelto = (cantidad: number): ItemCigarrillo => ({ esCigarrillo: true, esCigarroSuelto: true, cantidad })
const otro = (cantidad: number): ItemCigarrillo => ({ esCigarrillo: false, esCigarroSuelto: false, cantidad })

describe("calcularRecargoCigarrillos", () => {
  it("sin cigarrillos → 0", () => {
    expect(calcularRecargoCigarrillos([otro(3), otro(1)])).toBe(0)
    expect(calcularRecargoCigarrillos([])).toBe(0)
  })

  it("un atado → primer atado", () => {
    expect(calcularRecargoCigarrillos([atado(1)])).toBe(30000)
  })

  it("tres atados → primer atado + 2 adicionales", () => {
    // 30000 + 2×10000 = 50000
    expect(calcularRecargoCigarrillos([atado(3)])).toBe(50000)
  })

  it("atados de distintas marcas se cuentan juntos (escalonado por total)", () => {
    // 2 + 1 = 3 atados → 30000 + 2×10000 = 50000
    expect(calcularRecargoCigarrillos([atado(2), atado(1)])).toBe(50000)
  })

  it("cigarros sueltos → monto fijo por unidad", () => {
    expect(calcularRecargoCigarrillos([suelto(3)])).toBe(15000)
  })

  it("atados + sueltos se suman de forma independiente", () => {
    // 1 atado (30000) + 2 sueltos (10000) = 40000
    expect(calcularRecargoCigarrillos([atado(1), suelto(2)])).toBe(40000)
  })

  it("ignora items que no son cigarrillos", () => {
    expect(calcularRecargoCigarrillos([atado(1), otro(5), suelto(1)])).toBe(30000 + 5000)
  })
})
