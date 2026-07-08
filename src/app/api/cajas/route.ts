import { NextResponse } from "next/server"
import { requireSessionApi } from "@/lib/api-auth"
import { cajaService } from "@/services/caja.service"

export async function GET() {
  const result = await requireSessionApi()
  if ("error" in result) return result.error
  const data = await cajaService.listarActivas(result.user.organizationId)
  return NextResponse.json(data)
}
