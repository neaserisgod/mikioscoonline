import { NextRequest, NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/api-auth"
import { cajaSesionService } from "@/services/cajaSesion.service"

export async function GET(req: NextRequest) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error

  const cajaId = req.nextUrl.searchParams.get("cajaId") || undefined
  const data = await cajaSesionService.listarArqueosParciales(result.user.organizationId, { cajaId })
  return NextResponse.json(data)
}
