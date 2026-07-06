import { NextRequest, NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/api-auth"
import { rentabilidadService, type AgrupadorRentabilidad } from "@/services/rentabilidad.service"
import { inicioMes, finMes } from "@/domain/dinero"

const agrupadores: AgrupadorRentabilidad[] = ["proveedor", "heladera", "categoria", "caja"]

export async function GET(req: NextRequest) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error

  const { searchParams } = req.nextUrl
  const agrupador = (searchParams.get("por") ?? "categoria") as AgrupadorRentabilidad

  if (!agrupadores.includes(agrupador)) {
    return NextResponse.json(
      { error: `Agrupador inválido. Valores: ${agrupadores.join(", ")}` },
      { status: 422 }
    )
  }

  const ahora = new Date()
  const fechaDesde = searchParams.get("desde")
    ? new Date(searchParams.get("desde")!)
    : inicioMes(ahora)
  const fechaHasta = searchParams.get("hasta")
    ? new Date(searchParams.get("hasta")!)
    : finMes(ahora)

  const data = await rentabilidadService.porAgrupador({
    organizationId: result.user.organizationId,
    agrupador,
    fechaDesde,
    fechaHasta,
  })

  return NextResponse.json(data)
}
