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
  facturacionModoProduccion: z.boolean().optional(),
  imprimirTicketPosnet: z.boolean().optional(),
  stockMinimoDefault: z.number().int().min(0).optional(),
  horariosArqueo: z.string().regex(/^\d{2}:\d{2}(,\d{2}:\d{2})*$/, "Formato: HH:mm,HH:mm").optional().nullable(),
  sueldoObjetivoCentavos: z.number().int().min(0).optional(),
  monotributoCentavos: z.number().int().min(0).optional(),
})

export async function PATCH(req: NextRequest) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  try {
    const data = NegocioSchema.parse(await req.json())
    await organizacionService.actualizar(result.user.organizationId, data)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo guardar" }, { status: 400 })
  }
}
