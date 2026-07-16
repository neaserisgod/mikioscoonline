import { NextResponse } from "next/server"
import { requireSessionApi } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"

/**
 * A diferencia de factura-pdf (solo ADMIN, es el comprobante fiscal), este
 * ticket NO fiscal lo puede bajar cualquier usuario autenticado de la
 * organización — lo usa el propio POS (VENDEDOR incluido) justo después de
 * confirmar una venta, no solo el historial de ventas (admin-only).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireSessionApi()
  if ("error" in result) return result.error
  const { id } = await params

  const sale = await prisma.sale.findFirst({
    where: { id, organizationId: result.user.organizationId },
    select: { ticketPdf: true },
  })
  if (!sale?.ticketPdf) {
    return NextResponse.json({ error: "No hay ticket disponible para esta venta" }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(sale.ticketPdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ticket-${id}.pdf"`,
    },
  })
}
