import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/api-auth"
import { productoService } from "@/services/producto.service"

// Admin-only: expone gananciaPotencialCentavos (rentabilidad) por proveedor —
// mismo dato sensible que /api/rentabilidad, no puede quedar abierto a VENDEDOR
// aunque la pantalla que lo consume (/productos) ya sea admin-only.
export async function GET() {
  const result = await requireAdminApi()
  if ("error" in result) return result.error

  const data = await productoService.resumenProveedores(result.user.organizationId)
  return NextResponse.json(data)
}
