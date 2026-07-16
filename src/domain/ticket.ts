// Builder puro del contenido de un ticket de venta — punto único de armado
// (antes se rearmaba por separado en mercadopago-print.ts y ticket-client.tsx,
// con el riesgo de que cada copia calculara el subtotal de una línea distinto).
// Cada consumidor (posnet vía tags de MercadoPago, HTML del navegador, PDF de
// factura) solo traduce este modelo normalizado a su propio formato.

import { subtotalLinea } from "./pesables"
import { urlQrAfip } from "@/lib/providers/facturacion/afip-qr"

const NOMBRE_TIPO_COMPROBANTE: Record<string, string> = {
  FACTURA_A: "Factura A",
  FACTURA_B: "Factura B",
  FACTURA_C: "Factura C",
}

export interface LineaTicketInput {
  nombre: string
  esPesable: boolean
  cantidad: number
  gramos: number | null
  precioUnitarioCentavos: number
}

export interface ComprobanteTicketInput {
  estado: string
  tipo: string
  puntoVenta: number
  numero: number | null
  cae: string | null
  caeFechaVencimiento: Date | null
  cuitCliente: string | null
  /** Total del comprobante (con recargo incluido) — el que se usa para el QR de AFIP. */
  totalCentavos: number
}

export interface DatosTicketInput {
  organization: { nombre: string; cuit: string | null; condicionIva: string | null }
  fecha: Date
  lines: LineaTicketInput[]
  recargoCentavos: number
  /** Comprobante AFIP de la venta, si existe (null si nunca se facturó). */
  comprobante?: ComprobanteTicketInput | null
  /** true = se quiere un ticket FISCAL: si el comprobante está EMITIDO, incluye
   * el bloque fiscal (CAE + QR). false = ticket NO fiscal: nunca lleva bloque
   * fiscal aunque exista un comprobante, y siempre lleva la leyenda de "no
   * válido como factura" (ver regla de facturación por medio de pago, Fase B). */
  fiscal: boolean
}

export interface ItemTicket {
  descripcion: string
  subtotalCentavos: number
}

export interface BloqueFiscalTicket {
  tipoLabel: string
  puntoVenta: number
  numero: number
  cae: string
  caeFechaVencimientoLabel: string
  qrUrl: string
}

export interface TicketModel {
  negocio: { nombre: string; cuit: string | null; condicionIVA: string | null }
  fecha: Date
  items: ItemTicket[]
  recargoCentavos: number
  /** Total de productos + recargo. */
  totalCentavos: number
  /** Presente solo si se pidió fiscal:true y el comprobante ya está EMITIDO. */
  fiscal: BloqueFiscalTicket | null
  /** "COMPROBANTE NO FISCAL — no válido como factura" cuando fiscal:false; null en tickets fiscales. */
  leyendaNoFiscal: string | null
}

export function construirTicket(input: DatosTicketInput): TicketModel {
  const items: ItemTicket[] = input.lines.map((l) => ({
    descripcion: l.esPesable ? `${((l.gramos ?? 0) / 1000).toFixed(3)}kg ${l.nombre}` : `${l.cantidad}x ${l.nombre}`,
    subtotalCentavos: subtotalLinea({
      esPesable: l.esPesable,
      precioUnitarioCentavos: l.precioUnitarioCentavos,
      cantidad: l.cantidad,
      gramos: l.gramos,
    }),
  }))
  const totalProductosCentavos = items.reduce((sum, i) => sum + i.subtotalCentavos, 0)
  const totalCentavos = totalProductosCentavos + input.recargoCentavos

  const c = input.comprobante
  const fiscal: BloqueFiscalTicket | null =
    input.fiscal && c?.estado === "EMITIDO" && c.numero != null && c.cae && c.caeFechaVencimiento
      ? {
          tipoLabel: NOMBRE_TIPO_COMPROBANTE[c.tipo] ?? c.tipo,
          puntoVenta: c.puntoVenta,
          numero: c.numero,
          cae: c.cae,
          caeFechaVencimientoLabel: c.caeFechaVencimiento.toLocaleDateString("es-AR"),
          qrUrl: urlQrAfip({
            fecha: input.fecha,
            cuit: input.organization.cuit ?? "",
            puntoVenta: c.puntoVenta,
            tipo: c.tipo,
            numero: c.numero,
            totalCentavos: c.totalCentavos,
            cae: c.cae,
            cuitCliente: c.cuitCliente,
          }),
        }
      : null

  return {
    negocio: {
      nombre: input.organization.nombre,
      cuit: input.organization.cuit,
      condicionIVA: input.organization.condicionIva,
    },
    fecha: input.fecha,
    items,
    recargoCentavos: input.recargoCentavos,
    totalCentavos,
    fiscal,
    leyendaNoFiscal: input.fiscal ? null : "COMPROBANTE NO FISCAL — no válido como factura",
  }
}
