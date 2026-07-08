import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminApi } from "@/lib/api-auth"
import { proveedorService } from "@/services/config.service"

const EditarSchema = z.object({ nombre: z.string().min(1).optional(), activo: z.boolean().optional() })

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const { id } = await params
  try {
    const { activo, nombre } = EditarSchema.parse(await req.json())
    if (nombre !== undefined) await proveedorService.editar(id, result.user.organizationId, { nombre })
    if (activo === false) await proveedorService.desactivar(id, result.user.organizationId)
    if (activo === true) await proveedorService.reactivar(id, result.user.organizationId)
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
    await proveedorService.eliminar(id, result.user.organizationId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo eliminar" }, { status: 400 })
  }
}
