import { notFound } from "next/navigation"
import QRCode from "qrcode"
import { requireAdminSession } from "@/lib/session"
import { ventaService } from "@/services/venta.service"
import { construirTicket } from "@/domain/ticket"
import TicketClient from "./ticket-client"

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession()
  const { id } = await params

  const venta = await ventaService.obtener(id, session.user.organizationId)
  if (!venta) notFound()

  const c = venta.comprobante
  const ticket = construirTicket({
    organization: venta.organization,
    fecha: venta.fecha,
    lines: venta.lines.map((l) => ({
      nombre: l.product.nombre,
      esPesable: l.product.esPesable,
      cantidad: l.cantidad,
      gramos: l.gramos,
      precioUnitarioCentavos: l.precioUnitarioCentavos,
    })),
    recargoCentavos: venta.recargoCentavos,
    comprobante: c
      ? {
          estado: c.estado,
          tipo: c.tipo,
          puntoVenta: c.puntoVenta,
          numero: c.numero,
          cae: c.cae,
          caeFechaVencimiento: c.caeFechaVencimiento,
          cuitCliente: c.cuitCliente,
          totalCentavos: c.totalCentavos,
        }
      : null,
    fiscal: true,
  })

  const qrDataUrl = ticket.fiscal ? await QRCode.toDataURL(ticket.fiscal.qrUrl, { margin: 1, width: 200 }) : null

  return <TicketClient venta={venta} ticket={ticket} qrDataUrl={qrDataUrl} />
}
