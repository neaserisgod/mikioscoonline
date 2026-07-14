import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/api-auth"
import { productoService } from "@/services/producto.service"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const { id } = await params
  const data = await productoService.stockBajoPorProveedor(result.user.organizationId, id)
  return NextResponse.json(data)
}
