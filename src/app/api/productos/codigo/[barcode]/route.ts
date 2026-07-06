import { NextRequest, NextResponse } from "next/server"
import { requireSessionApi } from "@/lib/api-auth"
import { productoService } from "@/services/producto.service"
import { sanitizarProducto } from "@/lib/sanitizar-producto"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ barcode: string }> }
) {
  const result = await requireSessionApi()
  if ("error" in result) return result.error

  const { barcode } = await params
  const producto = await productoService.buscarPorCodigo(barcode, result.user.organizationId)

  if (!producto) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(sanitizarProducto(producto, result.user.role))
}
