import { prisma } from "@/lib/prisma"
import { imprimirTicketEnPosnet } from "@/lib/mercadopago-print"
import { urlQrAfip } from "@/lib/providers/facturacion/afip-qr"

const NOMBRE_TIPO_COMPROBANTE: Record<string, string> = {
  FACTURA_A: "Factura A",
  FACTURA_B: "Factura B",
  FACTURA_C: "Factura C",
}

export const impresionService = {
  /**
   * Imprime el tiquet de una venta en el posnet (si Organization.imprimirTicketPosnet
   * está activado y hay una terminal Point configurada). Si la venta tiene un
   * comprobante AFIP EMITIDO, lo incluye (CAE + QR de verificación) — llamar
   * DESPUÉS de facturacionService.facturarVenta si la venta dispara
   * facturación, para que salga en un solo tiquet. Best-effort: nunca lanza,
   * es un plus sobre la venta ya confirmada, no algo crítico como la
   * facturación — ver facturacionService para el patrón equivalente.
   */
  async imprimirTicketVenta(saleId: string, organizationId: string): Promise<void> {
    const org = await prisma.organization.findFirst({ where: { id: organizationId } })
    if (!org?.imprimirTicketPosnet) return

    const posnet = await prisma.paymentMethod.findFirst({
      where: { organizationId, mpTerminalId: { not: null }, activo: true },
    })
    if (!posnet?.mpTerminalId) return

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, organizationId },
      include: { lines: { include: { product: true } }, comprobante: true },
    })
    if (!sale) return

    const c = sale.comprobante
    const comprobante =
      c?.estado === "EMITIDO" && c.numero && c.cae && c.caeFechaVencimiento
        ? {
            tipoLabel: NOMBRE_TIPO_COMPROBANTE[c.tipo] ?? c.tipo,
            puntoVenta: c.puntoVenta,
            numero: c.numero,
            cae: c.cae,
            caeFechaVencimientoLabel: c.caeFechaVencimiento.toLocaleDateString("es-AR"),
            qrUrl: urlQrAfip({
              fecha: sale.fecha,
              cuit: org.cuit ?? "",
              puntoVenta: c.puntoVenta,
              tipo: c.tipo,
              numero: c.numero,
              totalCentavos: c.totalCentavos,
              cae: c.cae,
              cuitCliente: c.cuitCliente,
            }),
          }
        : undefined

    try {
      await imprimirTicketEnPosnet(posnet.mpTerminalId, {
        nombreNegocio: org.nombre,
        cuit: org.cuit,
        condicionIVA: org.condicionIva,
        fecha: sale.fecha,
        items: sale.lines.map((l) => ({
          descripcion: l.product.esPesable
            ? `${((l.gramos ?? 0) / 1000).toFixed(3)}kg ${l.product.nombre}`
            : `${l.cantidad}x ${l.product.nombre}`,
          precioCentavos: l.precioUnitarioCentavos * (l.product.esPesable ? 1 : l.cantidad),
        })),
        totalCentavos: sale.totalCentavos,
        recargoCentavos: sale.recargoCentavos,
        comprobante,
      })
    } catch {
      // Best-effort — si falla, la venta ya quedó confirmada igual.
    }
  },
}
