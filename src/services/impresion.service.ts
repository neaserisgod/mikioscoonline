import { prisma } from "@/lib/prisma"
import { getImpresionProvider } from "@/lib/providers/impresion"
import { construirTicket, type LineaTicketInput } from "@/domain/ticket"
import { generarPdfTicket } from "@/lib/pdf-ticket"
import { logError } from "@/lib/log"

/** Ítems de ejemplo para el ticket de prueba de Configuración — no salen de
 * ninguna venta real (ver generarTicketPrueba). Incluye uno pesable a
 * propósito, para poder ver ese formato también. */
const LINEAS_PRUEBA: LineaTicketInput[] = [
  { nombre: "Coca Cola 500ml", esPesable: false, cantidad: 2, gramos: null, precioUnitarioCentavos: 150000 },
  { nombre: "Alfajor Jorgito", esPesable: false, cantidad: 3, gramos: null, precioUnitarioCentavos: 80000 },
  { nombre: "Fiambre (prueba)", esPesable: true, cantidad: 1, gramos: 300, precioUnitarioCentavos: 900000 },
]
const RECARGO_PRUEBA_CENTAVOS = 5000

async function cargarVentaParaTicket(saleId: string, organizationId: string) {
  return prisma.sale.findFirst({
    where: { id: saleId, organizationId },
    include: {
      lines: { include: { product: true } },
      organization: { select: { nombre: true, cuit: true, condicionIva: true, imprimirTicketPosnet: true } },
    },
  })
}

function lineasTicket(sale: NonNullable<Awaited<ReturnType<typeof cargarVentaParaTicket>>>): LineaTicketInput[] {
  return sale.lines.map((l) => ({
    nombre: l.product.nombre,
    esPesable: l.product.esPesable,
    cantidad: l.cantidad,
    gramos: l.gramos,
    precioUnitarioCentavos: l.precioUnitarioCentavos,
  }))
}

export const impresionService = {
  /**
   * Se corre en segundo plano para TODA venta confirmada (ver
   * ventaService.crear), sin importar el medio de pago ni si la venta también
   * disparó facturación AFIP en paralelo (eso guarda su propio PDF fiscal en
   * Comprobante.pdf — ver facturacionService). Acá el ticket es SIEMPRE no
   * fiscal (con la leyenda de "no válido como factura"): el CAE y el QR de
   * verificación real, cuando existen, quedan solo en el ticket digital
   * (`/historial-ventas/[id]`) y el PDF de la factura.
   *
   * Dos cosas, ambas best-effort (nunca lanzan, un fallo acá no debe romper
   * la venta ya confirmada):
   * 1. Genera y guarda el PDF del ticket en `Sale.ticketPdf` — SIEMPRE.
   * 2. Si `Organization.imprimirTicketPosnet` está activo y hay una terminal
   *    Point configurada, imprime el mismo ticket ahí (ver el comentario de
   *    mercadopago-terminal.ts sobre por qué nunca lleva CAE/QR en el papel).
   */
  async procesarTicketVenta(saleId: string, organizationId: string): Promise<void> {
    const sale = await cargarVentaParaTicket(saleId, organizationId)
    if (!sale) return

    const ticket = construirTicket({
      organization: sale.organization,
      fecha: sale.fecha,
      lines: lineasTicket(sale),
      recargoCentavos: sale.recargoCentavos,
      comprobante: null,
      fiscal: false,
    })

    try {
      const pdf = await generarPdfTicket(ticket)
      await prisma.sale.update({ where: { id: saleId }, data: { ticketPdf: new Uint8Array(pdf) } })
    } catch (error) {
      logError("impresion.generarTicketPdf", error, { saleId })
    }

    if (!sale.organization.imprimirTicketPosnet) return
    const posnet = await prisma.paymentMethod.findFirst({
      where: { organizationId, mpTerminalId: { not: null }, activo: true },
    })
    if (!posnet?.mpTerminalId) return

    try {
      await getImpresionProvider().imprimir(posnet.mpTerminalId, ticket)
    } catch (error) {
      logError("impresion.procesarTicketVenta", error, { saleId })
    }
  },

  /**
   * Ticket de PRUEBA para Configuración — no crea ninguna venta ni escribe
   * nada en la base más que LEER Organization/PaymentMethod, y no llama a
   * AFIP. Ítems inventados, negocio real (nombre/CUIT/condición IVA), siempre
   * NO fiscal (no hay comprobante real al que apuntar). Devuelve el PDF en
   * base64 para que la Config lo baje directo, sin pasar por ninguna venta.
   *
   * A diferencia de procesarTicketVenta (que respeta
   * Organization.imprimirTicketPosnet), este botón es un test manual que el
   * cajero dispara a propósito — SIEMPRE intenta el posnet si hay una
   * terminal configurada, sin importar ese toggle (que solo gobierna el
   * auto-print de cada venta real). Devuelve el resultado para que la UI no
   * mienta diciendo "enviado" cuando en realidad no hay terminal o falló.
   */
  async generarTicketPrueba(organizationId: string): Promise<{
    pdfBase64: string
    posnetEstado: "enviado" | "sin_terminal" | "error"
  }> {
    const org = await prisma.organization.findFirstOrThrow({
      where: { id: organizationId },
      select: { nombre: true, cuit: true, condicionIva: true },
    })

    const ticket = construirTicket({
      organization: { nombre: org.nombre, cuit: org.cuit, condicionIva: org.condicionIva },
      fecha: new Date(),
      lines: LINEAS_PRUEBA,
      recargoCentavos: RECARGO_PRUEBA_CENTAVOS,
      comprobante: null,
      fiscal: false,
    })

    const pdf = await generarPdfTicket(ticket)

    const posnet = await prisma.paymentMethod.findFirst({
      where: { organizationId, mpTerminalId: { not: null }, activo: true },
    })
    let posnetEstado: "enviado" | "sin_terminal" | "error" = "sin_terminal"
    if (posnet?.mpTerminalId) {
      try {
        await getImpresionProvider().imprimir(posnet.mpTerminalId, ticket)
        posnetEstado = "enviado"
      } catch (error) {
        posnetEstado = "error"
        logError("impresion.generarTicketPrueba", error, { organizationId })
      }
    }

    return { pdfBase64: Buffer.from(pdf).toString("base64"), posnetEstado }
  },
}
