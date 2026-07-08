import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminApi } from "@/lib/api-auth"
import { medioPagoService } from "@/services/config.service"

const EditarSchema = z.object({
  nombre: z.string().min(1).optional(),
  comisionBp: z.number().int().min(0).optional(),
  esEfectivo: z.boolean().optional(),
  esMercadoPago: z.boolean().optional(),
  activo: z.boolean().optional(),
  cajaId: z.string().min(1).nullable().optional(),
  recargoTipo: z.enum(["PORCENTUAL", "FIJO"]).optional(),
  recargoVirtualBp: z.number().int().min(0).optional(),
  recargoVirtualFijoCentavos: z.number().int().min(0).optional(),
  mpExternalPosId: z.string().min(1).nullable().optional(),
  mpTerminalId: z.string().min(1).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const { id } = await params
  try {
    const { activo, ...resto } = EditarSchema.parse(await req.json())
    if (activo === false) {
      await medioPagoService.desactivar(id, result.user.organizationId)
    } else if (activo === true && Object.keys(resto).length === 0) {
      await medioPagoService.reactivar(id, result.user.organizationId)
    } else {
      await medioPagoService.editar(id, result.user.organizationId, { ...resto, activo })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo guardar" }, { status: 400 })
  }
}
