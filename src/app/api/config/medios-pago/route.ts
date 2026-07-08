import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionApi, requireAdminApi } from "@/lib/api-auth"
import { medioPagoService } from "@/services/config.service"

export async function GET() {
  const result = await requireSessionApi()
  if ("error" in result) return result.error
  const data = await medioPagoService.listar(result.user.organizationId)
  return NextResponse.json(data)
}

const MedioPagoSchema = z.object({
  nombre: z.string().min(1),
  comisionBp: z.number().int().min(0),
  esEfectivo: z.boolean().optional(),
  esMercadoPago: z.boolean().optional(),
  cajaId: z.string().min(1).nullable().optional(),
  recargoTipo: z.enum(["PORCENTUAL", "FIJO"]).optional(),
  recargoVirtualBp: z.number().int().min(0).optional(),
  recargoVirtualFijoCentavos: z.number().int().min(0).optional(),
  mpExternalPosId: z.string().min(1).nullable().optional(),
  mpTerminalId: z.string().min(1).nullable().optional(),
})

export async function POST(req: NextRequest) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  try {
    const data = MedioPagoSchema.parse(await req.json())
    const medio = await medioPagoService.crear(result.user.organizationId, data)
    return NextResponse.json(medio)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo crear" }, { status: 400 })
  }
}
