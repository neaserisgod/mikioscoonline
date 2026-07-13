import { NextRequest, NextResponse } from "next/server"
import { requireSessionApi } from "@/lib/api-auth"
import { productoService } from "@/services/producto.service"
import { sanitizarResumen } from "@/lib/sanitizar-producto"

// Mismo motivo que resumen-proveedores — devuelve gananciaPotencialCentavos, oculto para VENDEDOR.
export async function GET(req: NextRequest) {
  const result = await requireSessionApi()
  if ("error" in result) return result.error

  const providerIdParam = req.nextUrl.searchParams.get("providerId")
  if (!providerIdParam) {
    return NextResponse.json({ error: "Falta el parámetro providerId" }, { status: 400 })
  }
  const providerId = providerIdParam === "__sin_proveedor__" ? null : providerIdParam

  const data = await productoService.resumenCategorias(result.user.organizationId, providerId)
  return NextResponse.json(sanitizarResumen(data, result.user.role))
}
