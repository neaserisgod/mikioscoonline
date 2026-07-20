import { describe, it, expect } from "vitest"
import {
  calcularItemVenta,
  calcularTotalesVenta,
  determinarTipoComprobante,
  cuitEsValido,
} from "@/lib/fiscal"

describe("calcularItemVenta", () => {
  it("calcula correctamente con IVA 21%", () => {
    // precio bruto $1.210 → neto $1.000, IVA $210
    const result = calcularItemVenta(121000, 1, 21)
    expect(result.subtotalCentavos).toBe(121000)
    expect(result.netoCentavos).toBe(100000)
    expect(result.ivaCentavos).toBe(21000)
  })

  it("calcula correctamente con IVA 10.5%", () => {
    const result = calcularItemVenta(110500, 1, 10.5)
    expect(result.subtotalCentavos).toBe(110500)
    expect(result.netoCentavos).toBe(100000)
    expect(result.ivaCentavos).toBe(10500)
  })

  it("calcula correctamente con IVA 0%", () => {
    const result = calcularItemVenta(100000, 1, 0)
    expect(result.subtotalCentavos).toBe(100000)
    expect(result.netoCentavos).toBe(100000)
    expect(result.ivaCentavos).toBe(0)
  })

  it("multiplica correctamente por cantidad", () => {
    const result = calcularItemVenta(121000, 3, 21)
    expect(result.subtotalCentavos).toBe(363000)
    expect(result.netoCentavos).toBe(300000)
    expect(result.ivaCentavos).toBe(63000)
  })

  it("neto + iva = subtotal siempre", () => {
    for (const alicuota of [0, 10.5, 21]) {
      for (const precio of [100, 1333, 9999, 50000]) {
        const r = calcularItemVenta(precio, 1, alicuota)
        expect(r.netoCentavos + r.ivaCentavos).toBe(r.subtotalCentavos)
      }
    }
  })
})

describe("calcularTotalesVenta", () => {
  it("suma los totales correctamente", () => {
    const items = [
      { netoCentavos: 100000, ivaCentavos: 21000, subtotalCentavos: 121000 },
      { netoCentavos: 50000, ivaCentavos: 10500, subtotalCentavos: 60500 },
    ]
    const totales = calcularTotalesVenta(items)
    expect(totales.subtotalCentavos).toBe(150000)
    expect(totales.ivaTotalCentavos).toBe(31500)
    expect(totales.totalCentavos).toBe(181500)
  })
})

describe("determinarTipoComprobante", () => {
  it("RI + RI = Factura A", () => {
    expect(determinarTipoComprobante("RESPONSABLE_INSCRIPTO", "RESPONSABLE_INSCRIPTO")).toBe("FACTURA_A")
  })

  it("RI + CF = Factura B", () => {
    expect(determinarTipoComprobante("RESPONSABLE_INSCRIPTO", "CONSUMIDOR_FINAL")).toBe("FACTURA_B")
  })

  it("RI + Monotributo = Factura B", () => {
    expect(determinarTipoComprobante("RESPONSABLE_INSCRIPTO", "MONOTRIBUTO")).toBe("FACTURA_B")
  })

  it("Monotributo + cualquiera = Factura C", () => {
    expect(determinarTipoComprobante("MONOTRIBUTO", "RESPONSABLE_INSCRIPTO")).toBe("FACTURA_C")
    expect(determinarTipoComprobante("MONOTRIBUTO", "CONSUMIDOR_FINAL")).toBe("FACTURA_C")
  })
})

describe("cuitEsValido", () => {
  it("CUIT real de la organización (AFIP_CUIT, correcto): válido", () => {
    expect(cuitEsValido("20443236989")).toBe(true)
  })

  it("CUIT con dígitos transpuestos guardado hoy en Organization.cuit: inválido", () => {
    // 20443239689 vs. el correcto 20443236989 — mismo bug real que motivó
    // este test (ver docs/REPORTE-NUCLEO.md / sesión de facturación AFIP).
    expect(cuitEsValido("20443239689")).toBe(false)
  })

  it("acepta guiones/espacios (formato XX-XXXXXXXX-Y)", () => {
    expect(cuitEsValido("20-44323698-9")).toBe(true)
    expect(cuitEsValido("20 44323698 9")).toBe(true)
  })

  it("longitud distinta de 11 dígitos: inválido", () => {
    expect(cuitEsValido("2044323698")).toBe(false)
    expect(cuitEsValido("204432369899")).toBe(false)
    expect(cuitEsValido("")).toBe(false)
  })

  it("otro CUIT real conocido (ej. de test): válido", () => {
    // CUIT de ejemplo standard usado en documentación/testing de AFIP.
    expect(cuitEsValido("20111111112")).toBe(true)
  })
})
