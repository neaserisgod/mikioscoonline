import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import QRCode from "qrcode"
import { formatearARS } from "@/domain/dinero"
import type { TicketModel } from "@/domain/ticket"

const ANCHO = 280
const ALTO_LINEA = 14
const TAMANO_QR = 100

function dataUrlABytes(dataUrl: string): Uint8Array {
  return new Uint8Array(Buffer.from(dataUrl.split(",")[1], "base64"))
}

/**
 * PDF de archivo de un ticket de venta, a partir del modelo del builder de
 * ticket (mismo contenido que el papel impreso). Formato recibo angosto, no
 * A4: pensado para descarga/archivo, no para imprimirse en una impresora de
 * oficina.
 *
 * Si el ticket es fiscal (`ticket.fiscal` presente — comprobante EMITIDO)
 * incluye el bloque de CAE + el QR de verificación de AFIP embebido como
 * imagen. Si es no fiscal, en cambio, incluye la leyenda de
 * `ticket.leyendaNoFiscal` ("COMPROBANTE NO FISCAL — no válido como factura").
 *
 * Usado por dos caminos distintos: el PDF de la factura real
 * (facturacionService.facturarVenta, guardado en Comprobante.pdf) y el PDF
 * del ticket no fiscal que se guarda en TODA venta confirmada
 * (impresionService.procesarTicketVenta, guardado en Sale.ticketPdf).
 */
export async function generarPdfTicket(ticket: TicketModel): Promise<Uint8Array> {
  const fiscal = ticket.fiscal

  const lineasContenido =
    4 /* header */ +
    ticket.items.length +
    (ticket.recargoCentavos ? 1 : 0) +
    1 /* total */ +
    (fiscal ? 4 : ticket.leyendaNoFiscal ? 1 : 0)
  const altoExtra = fiscal ? TAMANO_QR + 40 : 20
  const alto = 24 + lineasContenido * ALTO_LINEA + altoExtra

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([ANCHO, alto])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let y = alto - 20

  function linea(texto: string, opts: { negrita?: boolean; centrado?: boolean; size?: number } = {}) {
    const size = opts.size ?? 9
    const f = opts.negrita ? bold : font
    const anchoTexto = f.widthOfTextAtSize(texto, size)
    const x = opts.centrado ? Math.max(8, (ANCHO - anchoTexto) / 2) : 10
    page.drawText(texto, { x, y, size, font: f, color: rgb(0, 0, 0) })
    y -= ALTO_LINEA
  }

  linea(ticket.negocio.nombre, { negrita: true, centrado: true, size: 11 })
  if (ticket.negocio.cuit) {
    linea(`CUIT ${ticket.negocio.cuit}${ticket.negocio.condicionIVA ? ` - ${ticket.negocio.condicionIVA}` : ""}`, {
      centrado: true,
      size: 8,
    })
  }
  linea(new Date(ticket.fecha).toLocaleString("es-AR"), { centrado: true, size: 8 })
  y -= 4

  for (const item of ticket.items) {
    linea(`${item.descripcion}  ${formatearARS(item.subtotalCentavos)}`)
  }
  if (ticket.recargoCentavos) {
    linea(`Recargo  ${formatearARS(ticket.recargoCentavos)}`)
  }
  y -= 4
  linea(`TOTAL ${formatearARS(ticket.totalCentavos)}`, { negrita: true })

  if (fiscal) {
    y -= 6
    linea(`${fiscal.tipoLabel} Pto.Vta ${fiscal.puntoVenta} Nro ${fiscal.numero}`, { size: 8 })
    linea(`CAE ${fiscal.cae}`, { size: 8 })
    linea(`Vto. CAE ${fiscal.caeFechaVencimientoLabel}`, { size: 8 })

    const qrDataUrl = await QRCode.toDataURL(fiscal.qrUrl, { margin: 1, width: TAMANO_QR * 2 })
    const qrImage = await pdfDoc.embedPng(dataUrlABytes(qrDataUrl))
    page.drawImage(qrImage, { x: (ANCHO - TAMANO_QR) / 2, y: y - TAMANO_QR, width: TAMANO_QR, height: TAMANO_QR })
  } else if (ticket.leyendaNoFiscal) {
    y -= 6
    linea(ticket.leyendaNoFiscal, { centrado: true, size: 8 })
  }

  return pdfDoc.save()
}
