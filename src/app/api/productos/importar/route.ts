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
  // Tope de tamaño — cada fila se procesa secuencialmente (upserts de categoría/
  // proveedor incluidos), un archivo enorme podría colgar el request.
  const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
  if (Buffer.byteLength(text, "utf-8") > MAX_BYTES) {
    return NextResponse.json({ error: "El archivo supera el tamaño máximo permitido (5 MB)" }, { status: 413 })
  }

  const resultado = await productoService.importarCSV(text, session.user.organizationId)
  return NextResponse.json(resultado, { status: resultado.errores.length === 0 ? 200 : 207 })
}
