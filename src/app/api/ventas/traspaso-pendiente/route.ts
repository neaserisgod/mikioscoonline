import { NextResponse } from "next/server"
import { requireSessionApi } from "@/lib/api-auth"
import { ventaService } from "@/services/venta.service"

export async function GET() {
  const result = await requireSessionApi()
  if ("error" in result) return result.error

  const data = await ventaService.listarTraspasosPendientes(result.user.organizationId)
  return NextResponse.json(data)
}
