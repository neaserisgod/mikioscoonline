import { NextRequest, NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/api-auth"
import { productoService } from "@/services/producto.service"

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error

  const { id } = await ctx.params
  const producto = await productoService.obtener(id, result.user.organizationId)
  if (!producto) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json(producto)
}
