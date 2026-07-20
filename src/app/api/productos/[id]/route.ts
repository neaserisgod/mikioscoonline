import { NextRequest, NextResponse } from "next/server"
import { requireSessionApi } from "@/lib/api-auth"
import { productoService } from "@/services/producto.service"
import { sanitizarProducto } from "@/lib/sanitizar-producto"

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const result = await requireSessionApi()
  if ("error" in result) return result.error

  const { id } = await ctx.params
  const producto = await productoService.obtener(id, result.user.organizationId)
  if (!producto) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json(sanitizarProducto(producto, result.user.role))
}
