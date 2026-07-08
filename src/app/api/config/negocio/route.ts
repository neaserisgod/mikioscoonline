import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminApi } from "@/lib/api-auth"
import { organizacionService } from "@/services/config.service"

export async function GET() {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const data = await organizacionService.obtener(result.user.organizationId)
  return NextResponse.json(data)
}

const NegocioSchema = z.object({
  nombre: z.string().min(1).optional(),
  cuit: z.string().optional().nullable(),
  condicionIva: z.enum(["RESPONSABLE_INSCRIPTO", "MONOTRIBUTO", "EXENTO", "CONSUMIDOR_FINAL"]).optional().nullable(),
  puntoDeVenta: z.number().int().positive().optional().nullable(),
  stockMinimoDefault: z.number().int().min(0).optional(),
  saldoMpCentavos: z.number().int().min(0).optional(),
})

export async function PATCH(req: NextRequest) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  try {
    const { saldoMpCentavos, ...resto } = NegocioSchema.parse(await req.json())
    if (saldoMpCentavos !== undefined) {
      await organizacionService.actualizarSaldoMp(result.user.organizationId, saldoMpCentavos)
    }
    if (Object.keys(resto).length > 0) {
      await organizacionService.actualizar(result.user.organizationId, resto)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo guardar" }, { status: 400 })
  }
}
