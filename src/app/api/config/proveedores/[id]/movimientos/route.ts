import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/api-auth"
import { proveedorService } from "@/services/config.service"
import { logError } from "@/lib/log"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const { id } = await params
  try {
    const data = await proveedorService.listarMovimientosCuentaCorriente(id, result.user.organizationId)
    return NextResponse.json(data)
  } catch (e) {
    logError("proveedores.movimientos", e, { providerId: id, organizationId: result.user.organizationId })
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo cargar" }, { status: 400 })
  }
}
