import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/api-auth"
import { categoriaService } from "@/services/config.service"

export async function GET() {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const data = await categoriaService.listar(result.user.organizationId)
  return NextResponse.json(data)
}
