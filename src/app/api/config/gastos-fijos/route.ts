import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminApi } from "@/lib/api-auth"
import { gastoFijoService } from "@/services/config.service"

export async function GET() {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const data = await gastoFijoService.listar(result.user.organizationId)
  return NextResponse.json(data)
}

const GastoFijoSchema = z.object({
  nombre: z.string().min(1),
  montoMensualCentavos: z.number().int().positive(),
  mesAnio: z.string().regex(/^\d{4}-\d{2}$/).optional(),
})

export async function POST(req: NextRequest) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  try {
    const data = GastoFijoSchema.parse(await req.json())
    const gasto = await gastoFijoService.crear(result.user.organizationId, data)
    return NextResponse.json(gasto)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo crear" }, { status: 400 })
  }
}
