import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/api-auth"
import { proveedorService } from "@/services/config.service"

export async function GET() {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const data = await proveedorService.listar(result.user.organizationId)
  return NextResponse.json(data)
}
