import { describe, it, expect } from "vitest"
import { construirTicket, type DatosTicketInput } from "@/domain/ticket"

const organization = { nombre: "Kiosco Don Juan", cuit: "20111111112", condicionIva: "MONOTRIBUTO" }

const lines = [
  { nombre: "Coca 500ml", esPesable: false, cantidad: 2, gramos: null, precioUnitarioCentavos: 150000 },
  { nombre: "Fiambre", esPesable: true, cantidad: 1, gramos: 250, precioUnitarioCentavos: 800000 }, // $8000/kg
]

const comprobanteEmitido = {
  id: "comp_1",
  estado: "EMITIDO",
  tipo: "FACTURA_C",
  puntoVenta: 2,
  numero: 123,
  cae: "75012345678901",
  caeFechaVencimiento: new Date("2026-08-01"),
  cuitCliente: null,
  totalCentavos: 500000,
}

function baseInput(overrides: Partial<DatosTicketInput> = {}): DatosTicketInput {
  return {
    organization,
    fecha: new Date("2026-07-16T12:00:00Z"),
    lines,
    recargoCentavos: 0,
    comprobante: null,
    fiscal: false,
    ...overrides,
  }
}

describe("construirTicket", () => {
  it("calcula ítems y total usando subtotalLinea (pesables por kg, resto por unidad)", () => {
    const ticket = construirTicket(baseInput())
    // Coca: 150000 × 2 = 300000. Fiambre: 800000 × 250 / 1000 = 200000.
    expect(ticket.items).toEqual([
      { descripcion: "2x Coca 500ml", subtotalCentavos: 300000 },
      { descripcion: "0.250kg Fiambre", subtotalCentavos: 200000 },
    ])
    expect(ticket.totalCentavos).toBe(500000)
  })

  it("suma el recargo al total", () => {
    const ticket = construirTicket(baseInput({ recargoCentavos: 5000 }))
    expect(ticket.totalCentavos).toBe(505000)
    expect(ticket.recargoCentavos).toBe(5000)
  })

  it("fiscal:true con comprobante EMITIDO incluye el bloque fiscal y no lleva leyenda", () => {
    const ticket = construirTicket(baseInput({ fiscal: true, comprobante: comprobanteEmitido }))
    expect(ticket.fiscal).not.toBeNull()
    expect(ticket.fiscal?.tipoLabel).toBe("Factura C")
    expect(ticket.fiscal?.numero).toBe(123)
    expect(ticket.fiscal?.cae).toBe("75012345678901")
    expect(ticket.fiscal?.qrUrl).toContain("afip.gob.ar")
    expect(ticket.leyendaNoFiscal).toBeNull()
  })

  it("fiscal:true sin comprobante EMITIDO no incluye bloque fiscal ni leyenda (facturación pendiente, no 'no fiscal')", () => {
    const ticket = construirTicket(baseInput({ fiscal: true, comprobante: null }))
    expect(ticket.fiscal).toBeNull()
    expect(ticket.leyendaNoFiscal).toBeNull()
  })

  it("fiscal:false nunca incluye el bloque fiscal, aun con comprobante EMITIDO, y siempre lleva la leyenda", () => {
    const ticket = construirTicket(baseInput({ fiscal: false, comprobante: comprobanteEmitido }))
    expect(ticket.fiscal).toBeNull()
    expect(ticket.leyendaNoFiscal).toBe("COMPROBANTE NO FISCAL — no válido como factura")
  })
})
