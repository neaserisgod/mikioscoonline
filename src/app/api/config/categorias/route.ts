import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminApi } from "@/lib/api-auth"
import { categoriaService } from "@/services/config.service"

export async function GET() {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const data = await categoriaService.listar(result.user.organizationId)
  return NextResponse.json(data)
}

const CategoriaSchema = z.object({
  nombre: z.string().min(1),
  markupDefaultBp: z.number().int().min(0),
  markupDefaultTipo: z.enum(["PORCENTUAL", "FIJO"]).optional(),
  markupDefaultFijoCentavos: z.number().int().min(0).optional(),
})

export async function POST(req: NextRequest) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  try {
    const data = CategoriaSchema.parse(await req.json())
    const categoria = await categoriaService.crear(result.user.organizationId, data)
    return NextResponse.json(categoria)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo crear" }, { status: 400 })
  }
}
