import { NextRequest, NextResponse } from "next/server"
import { requireSessionApi } from "@/lib/api-auth"
import { resumenService } from "@/services/resumen.service"
import { parseFechaQuery } from "@/domain/dinero"

export async function GET(req: NextRequest) {
  const result = await requireSessionApi()
  if ("error" in result) return result.error
  const { organizationId, role } = result.user

  const { searchParams } = req.nextUrl
  const mesParam = searchParams.get("mes") // "YYYY-MM" opcional
  const mesFecha = mesParam ? parseFechaQuery(`${mesParam}-01`) : undefined
  if (mesFecha === null) {
    return NextResponse.json({ error: "Parámetro mes inválido (esperado YYYY-MM)" }, { status: 400 })
  }

  return NextResponse.json(await resumenService.dashboard(organizationId, role, mesFecha))
}
