import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionApi, requireAdminApi } from "@/lib/api-auth"
import { categoriaService } from "@/services/config.service"

// VENDEDOR necesita la lista de categorías para el selector al agregar/editar
// productos, pero no el margen default de cada una (markupDefault*) — se
// resuelve server-side en producto.service.ts sin que el cliente lo mande.
export async function GET() {
  const result = await requireSessionApi()
  if ("error" in result) return result.error
  const data = await categoriaService.listar(result.user.organizationId)
  if (result.user.role === "ADMIN") return NextResponse.json(data)
  const sanitizado = data.map((c) => ({ ...c, markupDefaultBp: 0, markupDefaultFijoCentavos: 0 }))
  return NextResponse.json(sanitizado)
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
