import { NextRequest, NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/api-auth"
import { proveedorService } from "@/services/config.service"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const { id } = await params
  const porcentaje = Number(req.nextUrl.searchParams.get("porcentaje"))
  if (!Number.isFinite(porcentaje) || porcentaje === 0) {
    return NextResponse.json({ error: "Porcentaje inválido" }, { status: 400 })
  }
  const data = await proveedorService.previsualizarAjusteCosto(id, result.user.organizationId, porcentaje)
  return NextResponse.json(data)
}
