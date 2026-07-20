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
  const costoProvisional = searchParams.get("costoProvisional") === "1"
  const margenNegativo = searchParams.get("margenNegativo") === "1"
  const since = searchParams.get("since")
  const masVendidos = searchParams.get("masVendidos") === "1"
  const providerId = searchParams.get("providerId") ?? undefined
  const categoryId = searchParams.get("categoryId") ?? undefined

  if (stockBajo) {
    const data = await productoService.stockBajo(organizationId)
    return NextResponse.json(data)
  }

  // Filtros con costo/precio real — nunca para VENDEDOR (ver sanitizarProducto).
  if (costoProvisional || margenNegativo) {
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Solo ADMIN puede ver esto" }, { status: 403 })
    }
    const data = costoProvisional
      ? await productoService.costoProvisional(organizationId)
      : await productoService.margenNegativo(organizationId)
    return NextResponse.json(data)
  }

  if (masVendidos) {
    const data = await productoService.masVendidos(organizationId, 30, 10)
    return NextResponse.json(sanitizarProductos(data, role))
  }

  if (since) {
    const desde = new Date(since)
    if (Number.isNaN(desde.getTime())) {
      return NextResponse.json({ error: "Parámetro 'since' inválido" }, { status: 400 })
    }
    const data = await productoService.listarDesde(organizationId, desde)
    return NextResponse.json(sanitizarProductos(data, role))
  }

  if (q) {
    return NextResponse.json(sanitizarProductos(await productoService.buscar(organizationId, q), role))
  }

  if (providerId !== undefined || categoryId !== undefined) {
    const data = await productoService.listarFiltrado(organizationId, { providerId, categoryId })
    return NextResponse.json(sanitizarProductos(data, role))
  }

  const data = await productoService.listar(organizationId)
  return NextResponse.json(sanitizarProductos(data, role))
}
