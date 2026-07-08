import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminApi } from "@/lib/api-auth"
import { usuarioService } from "@/services/config.service"

const EditarSchema = z.object({
  activo: z.boolean().optional(),
  role: z.enum(["ADMIN", "VENDEDOR"]).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const { id } = await params
  try {
    const { activo, role } = EditarSchema.parse(await req.json())
    if (activo === false) await usuarioService.desactivar(id, result.user.organizationId, result.user.id)
    if (activo === true) await usuarioService.reactivar(id, result.user.organizationId)
    if (role !== undefined) await usuarioService.cambiarRol(id, result.user.organizationId, role, result.user.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo guardar" }, { status: 400 })
  }
}
