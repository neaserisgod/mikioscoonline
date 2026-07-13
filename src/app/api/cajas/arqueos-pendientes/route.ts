import { NextResponse } from "next/server"
import { requireSessionApi } from "@/lib/api-auth"
import { cajaSesionService } from "@/services/cajaSesion.service"

export async function GET() {
  const result = await requireSessionApi()
  if ("error" in result) return result.error

  const data = await cajaSesionService.arqueosPendientes(result.user.organizationId)
  return NextResponse.json(data)
}
