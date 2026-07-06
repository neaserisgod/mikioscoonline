import { NextRequest, NextResponse } from "next/server"
import { requireSessionApi } from "@/lib/api-auth"
import { productoService } from "@/services/producto.service"
import { sanitizarProductos } from "@/lib/sanitizar-producto"

export async function GET(req: NextRequest) {
  const result = await requireSessionApi()
  if ("error" in result) return result.error
  const { organizationId, role } = result.user

  const { searchParams } = req.nextUrl
  const q = searchParams.get("q")
  const stockBajo = searchParams.get("stockBajo") === "1"

  if (stockBajo) {
    const data = await productoService.stockBajo(organizationId)
    return NextResponse.json(data)
  }

  const data = q
    ? await productoService.buscar(organizationId, q)
    : await productoService.listar(organizationId)

  return NextResponse.json(sanitizarProductos(data, role))
}
