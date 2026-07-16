import type { TicketModel } from "@/domain/ticket"
import type { ImpresionProvider } from "./types"

function formatearARS(centavos: number): string {
  return "$" + (centavos / 100).toLocaleString("es-AR", { minimumFractionDigits: 2 })
}

/**
 * Imprime un tiquet en una terminal Point vía POST /terminals/v1/actions
 * (type: "print") — acción independiente de cualquier cobro, no requiere que
 * la venta se haya pagado con esa terminal. Usa el lenguaje de tags propio de
 * MercadoPago: {b} negrita, {w} letra grande, {s} chica, {center}, {br}, {qr}.
 *
 * IMPORTANTE — verificado a mano contra una terminal Newland N950 real, no
 * documentado así por MercadoPago: el tag {left} en la práctica alinea el
 * texto a la DERECHA, y el texto sin ningún tag de alineación queda a la
 * izquierda por default. Se usa así a propósito acá abajo (descripción sin
 * tag = izquierda, precio con {left} = derecha) para lograr un layout de dos
 * líneas por ítem — no hay tag de columnas/tabla en esta API.
 *
 * NOTA — el {qr} con la URL larga de AFIP (~300 caracteres, RG 4291) imprime
 * denso y no escanea en esta Newland N950 (confirmado a mano, ver también el
 * intento descartado de `subtype: "image"`, que directamente traba la
 * terminal). Por eso `impresionService.procesarTicketVenta` ya NO arma tickets
 * fiscales para el posnet — siempre manda `fiscal: false` (ver ese archivo).
 * Esta función igual sabe manejar un ticket fiscal por completitud del tipo
 * (`TicketModel.fiscal` existe y se usa en el PDF/ticket digital), aunque hoy
 * ningún caller real le pasa uno — si algún día vuelve a hacer falta, el QR
 * ahí sale con la limitación conocida.
 */
export class MercadoPagoTerminalProvider implements ImpresionProvider {
  async imprimir(terminalId: string, ticket: TicketModel): Promise<void> {
    const lineasItems = ticket.items
      .map((i) => `${i.descripcion}{br}{left}${formatearARS(i.subtotalCentavos)}{/left}{br}`)
      .join("")

    const datosEmisor = ticket.negocio.cuit
      ? `{center}{s}CUIT ${ticket.negocio.cuit}${ticket.negocio.condicionIVA ? ` - ${ticket.negocio.condicionIVA}` : ""}{/s}{/center}{br}`
      : ""

    // Bloque de datos fiscales — solo si ya hay CAE. Incluye el QR de
    // verificación de AFIP (RG 4291), obligatorio en la representación impresa
    // de todo comprobante electrónico. Si el ticket es no-fiscal, en cambio,
    // se imprime la leyenda de "no válido como factura".
    const bloqueComprobante = ticket.fiscal
      ? "--------------------------------{br}" +
        `${ticket.fiscal.tipoLabel} Pto.Vta ${ticket.fiscal.puntoVenta} Nro ${ticket.fiscal.numero}{br}` +
        `CAE ${ticket.fiscal.cae}{br}` +
        `Vto. CAE ${ticket.fiscal.caeFechaVencimientoLabel}{br}` +
        `{center}{qr}${ticket.fiscal.qrUrl}{/qr}{/center}{br}`
      : ticket.leyendaNoFiscal
        ? `--------------------------------{br}{center}{s}${ticket.leyendaNoFiscal}{/s}{/center}{br}`
        : ""

    const lineaRecargo = ticket.recargoCentavos
      ? `Recargo cigarrillos{br}{left}${formatearARS(ticket.recargoCentavos)}{/left}{br}`
      : ""

    const content =
      `{center}{w}${ticket.negocio.nombre}{/w}{/center}{br}` +
      datosEmisor +
      `{center}{s}${ticket.fecha.toLocaleString("es-AR")}{/s}{/center}{br}` +
      "--------------------------------{br}" +
      lineasItems +
      lineaRecargo +
      "--------------------------------{br}" +
      `{left}{b}TOTAL ${formatearARS(ticket.totalCentavos)}{/b}{/left}{br}` +
      bloqueComprobante +
      "{center}Gracias por su compra{/center}{br}"

    const res = await fetch("https://api.mercadopago.com/terminals/v1/actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        type: "print",
        external_reference: `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        config: { point: { terminal_id: terminalId, subtype: "custom" } },
        content,
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(`MercadoPago Terminals API (${res.status}): ${body?.message ?? res.statusText}`)
    }
  }
}
