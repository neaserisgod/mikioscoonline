import { NextRequest, NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/api-auth"
import { ventaService } from "@/services/venta.service"
import { parseFechaQuery } from "@/domain/dinero"

export async function GET(req: NextRequest) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error

  const { searchParams } = req.nextUrl
  const desde = parseFechaQuery(searchParams.get("desde"))
  const hasta = parseFechaQuery(searchParams.get("hasta"))
  if (desde === null || hasta === null) {
    return NextResponse.json({ error: "Fecha inválida en desde/hasta" }, { status: 400 })
  }

  const ventas = await ventaService.listar(result.user.organizationId, { fechaDesde: desde, fechaHasta: hasta })

  const rows = [
    ["id", "fecha", "usuario", "items", "medioPago", "totalPesos", "costoPesos", "gananciaPesos"],
    ...ventas.map((v) => {
      const gananciaCentavos = v.totalCentavos - v.costoTotalCentavos
      const medios = v.payments.map((p) => p.paymentMethod.nombre).join(" + ")
      return [
        v.id,
        new Date(v.fecha).toLocaleDateString("es-AR"),
        v.user.nombre,
        v._count.lines,
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
