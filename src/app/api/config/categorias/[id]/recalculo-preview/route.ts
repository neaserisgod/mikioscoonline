import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/api-auth"
import { categoriaService } from "@/services/config.service"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const { id } = await params
  const data = await categoriaService.previsualizarRecalculo(id, result.user.organizationId)
  return NextResponse.json(data)
}
