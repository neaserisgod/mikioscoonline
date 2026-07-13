import { NextResponse } from "next/server"
import { requireSessionApi } from "@/lib/api-auth"
import { productoService } from "@/services/producto.service"
import { sanitizarResumen } from "@/lib/sanitizar-producto"

// VENDEDOR puede navegar el catálogo por proveedor (necesita agregar/editar
// productos), pero gananciaPotencialCentavos/valorCosto/valorVenta se ocultan
// — mismo dato sensible que /api/rentabilidad.
export async function GET() {
  const result = await requireSessionApi()
  if ("error" in result) return result.error

  const data = await productoService.resumenProveedores(result.user.organizationId)
  return NextResponse.json(sanitizarResumen(data, result.user.role))
}
