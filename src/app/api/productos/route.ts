import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { productoService } from "@/services/producto.service"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const q = searchParams.get("q")
  const stockBajo = searchParams.get("stockBajo") === "1"

  if (stockBajo) {
    const data = await productoService.stockBajo(session.user.organizationId)
    return NextResponse.json(data)
  }

  const data = q
    ? await productoService.buscar(session.user.organizationId, q)
    : await productoService.listar(session.user.organizationId)

  return NextResponse.json(data)
}
