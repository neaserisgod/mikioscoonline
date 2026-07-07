import { NextRequest, NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/api-auth"
import { rentabilidadService, type AgrupadorRentabilidad } from "@/services/rentabilidad.service"
import { parseFechaQuery } from "@/domain/dinero"

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

  const desdeParam = parseFechaQuery(searchParams.get("desde"))
  const hastaParam = parseFechaQuery(searchParams.get("hasta"))
  if (desdeParam === null || hastaParam === null) {
    return NextResponse.json({ error: "Fecha inválida en desde/hasta" }, { status: 400 })
  }

  // Sin desde/hasta = histórico completo, sin límite de fecha (ver rentabilidad-client.tsx,
  // toggle "Mes actual" / "Histórico").
  const data = await rentabilidadService.porAgrupador({
    organizationId: result.user.organizationId,
    agrupador,
    fechaDesde: desdeParam,
    fechaHasta: hastaParam,
  })

  return NextResponse.json(data)
}
