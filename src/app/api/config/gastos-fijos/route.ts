import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/api-auth"
import { gastoFijoService } from "@/services/config.service"

export async function GET() {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const data = await gastoFijoService.listar(result.user.organizationId)
  return NextResponse.json(data)
}
