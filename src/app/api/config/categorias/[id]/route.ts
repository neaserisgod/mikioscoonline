import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminApi } from "@/lib/api-auth"
import { categoriaService } from "@/services/config.service"

const EditarSchema = z.object({
  nombre: z.string().min(1).optional(),
  markupDefaultBp: z.number().int().min(0).optional(),
  markupDefaultTipo: z.enum(["PORCENTUAL", "FIJO"]).optional(),
  markupDefaultFijoCentavos: z.number().int().min(0).optional(),
  activo: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const { id } = await params
  try {
    const { activo, ...resto } = EditarSchema.parse(await req.json())
    if (Object.keys(resto).length > 0) {
      await categoriaService.editar(id, result.user.organizationId, resto)
    }
    if (activo === false) await categoriaService.desactivar(id, result.user.organizationId)
    if (activo === true) await categoriaService.reactivar(id, result.user.organizationId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo guardar" }, { status: 400 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const { id } = await params
  try {
    await categoriaService.eliminar(id, result.user.organizationId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo eliminar" }, { status: 400 })
  }
}
