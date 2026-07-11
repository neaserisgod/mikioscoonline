import { NextRequest, NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/api-auth"
import { productoService } from "@/services/producto.service"

// Admin-only: mismo motivo que resumen-proveedores — devuelve gananciaPotencialCentavos.
export async function GET(req: NextRequest) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error

  const providerIdParam = req.nextUrl.searchParams.get("providerId")
  if (!providerIdParam) {
    return NextResponse.json({ error: "Falta el parámetro providerId" }, { status: 400 })
  }
  const providerId = providerIdParam === "__sin_proveedor__" ? null : providerIdParam

  const data = await productoService.resumenCategorias(result.user.organizationId, providerId)
  return NextResponse.json(data)
}
