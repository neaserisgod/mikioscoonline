import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { ventaService } from "@/services/venta.service"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const desde = searchParams.get("desde") ? new Date(searchParams.get("desde")!) : undefined
  const hasta = searchParams.get("hasta") ? new Date(searchParams.get("hasta")!) : undefined

  const ventas = await ventaService.listar(session.user.organizationId, { fechaDesde: desde, fechaHasta: hasta })

  const rows = [
    ["id", "fecha", "usuario", "items", "medioPago", "totalPesos", "costoPesos", "gananciaPesos"],
    ...ventas.map((v) => {
      const gananciaCentavos = v.totalCentavos - v.costoTotalCentavos
      const medios = v.payments.map((p) => p.paymentMethod.nombre).join(" + ")
      return [
        v.id,
        new Date(v.fecha).toLocaleDateString("es-AR"),
        v.user.nombre,
        v.lines.length,
        medios,
        (v.totalCentavos / 100).toFixed(2),
        (v.costoTotalCentavos / 100).toFixed(2),
        (gananciaCentavos / 100).toFixed(2),
      ]
    }),
  ]

  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
  const filename = `ventas-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
