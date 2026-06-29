import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { productoService } from "@/services/producto.service"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ barcode: string }> }
) {
  const session = await auth()
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { barcode } = await params
  const producto = await productoService.buscarPorCodigo(barcode, session.user.organizationId)

  if (!producto) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(producto)
}
