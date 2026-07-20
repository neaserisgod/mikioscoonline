import { NextResponse } from "next/server"
import { requireSessionApi } from "@/lib/api-auth"
import { ventaService } from "@/services/venta.service"

export async function GET() {
  const result = await requireSessionApi()
  if ("error" in result) return result.error

  try {
    const data = await ventaService.listarTraspasosPendientes(result.user.organizationId)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "No se pudo cargar el estado de traspasos pendientes" }, { status: 500 })
  }
}
