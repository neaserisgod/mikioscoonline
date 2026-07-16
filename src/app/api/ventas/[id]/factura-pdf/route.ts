import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const { id } = await params

  const sale = await prisma.sale.findFirst({
    where: { id, organizationId: result.user.organizationId },
    select: { comprobante: { select: { pdf: true, estado: true, tipo: true, numero: true } } },
  })
  const comprobante = sale?.comprobante
  if (!comprobante || comprobante.estado !== "EMITIDO" || !comprobante.pdf) {
    return NextResponse.json({ error: "No hay PDF disponible para esta venta" }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(comprobante.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="factura-${comprobante.tipo}-${comprobante.numero}.pdf"`,
    },
  })
}
