import { NextRequest, NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/api-auth"
import { cajaSesionService } from "@/services/cajaSesion.service"
import { parseFechaQuery, finDia } from "@/domain/dinero"

export async function GET(req: NextRequest) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error

  const { searchParams } = req.nextUrl
  const cajaId = searchParams.get("cajaId") || undefined
  const desdeParam = parseFechaQuery(searchParams.get("desde"))
  const hastaParam = parseFechaQuery(searchParams.get("hasta"))
  if (desdeParam === null || hastaParam === null) {
    return NextResponse.json({ error: "Fecha inválida en desde/hasta" }, { status: 400 })
  }
  // Extendido al fin del día — si no, pedir un solo día (desde === hasta) da 0 resultados.
  const hasta = hastaParam ? finDia(hastaParam) : hastaParam

  const data = await cajaSesionService.listarMovimientos(result.user.organizationId, {
    cajaId,
    desde: desdeParam ?? undefined,
    hasta: hasta ?? undefined,
  })
  return NextResponse.json(data)
}
