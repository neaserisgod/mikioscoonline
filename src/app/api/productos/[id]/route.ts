import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { productoService } from "@/services/producto.service"

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await ctx.params
  const producto = await productoService.obtener(id, session.user.organizationId)
  if (!producto) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json(producto)
}
