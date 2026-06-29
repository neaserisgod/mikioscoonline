import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { productoService } from "@/services/producto.service"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo ADMIN puede importar productos" }, { status: 403 })
  }

  const text = await req.text()
  if (!text.trim()) {
    return NextResponse.json({ error: "CSV vacío" }, { status: 422 })
  }

  const resultado = await productoService.importarCSV(text, session.user.organizationId)
  return NextResponse.json(resultado, { status: resultado.errores.length === 0 ? 200 : 207 })
}
