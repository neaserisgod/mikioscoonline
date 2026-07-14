import { notFound } from "next/navigation"
import { requireAdminSession } from "@/lib/session"
import { ventaService } from "@/services/venta.service"
import { qrAfipDataUrl } from "@/lib/providers/facturacion/afip-qr"
import TicketClient from "./ticket-client"

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession()
  const { id } = await params

  const venta = await ventaService.obtener(id, session.user.organizationId)
  if (!venta) notFound()

  let qrDataUrl: string | null = null
  if (venta.comprobante?.estado === "EMITIDO" && venta.comprobante.cae && venta.organization.cuit) {
    qrDataUrl = await qrAfipDataUrl({
      fecha: venta.fecha,
      cuit: venta.organization.cuit,
      puntoVenta: venta.comprobante.puntoVenta,
      tipo: venta.comprobante.tipo,
      numero: venta.comprobante.numero ?? 0,
      totalCentavos: venta.comprobante.totalCentavos,
      cae: venta.comprobante.cae,
      cuitCliente: venta.comprobante.cuitCliente,
    })
  }

  return <TicketClient venta={venta} qrDataUrl={qrDataUrl} />
}
