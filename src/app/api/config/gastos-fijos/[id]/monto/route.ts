import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminApi } from "@/lib/api-auth"
import { gastoFijoService } from "@/services/config.service"

const Schema = z.object({
  montoCentavos: z.number().int().min(0),
  mesAnio: z.string().regex(/^\d{4}-\d{2}$/).optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const { id } = await params
  try {
    const { montoCentavos, mesAnio } = Schema.parse(await req.json())
    const monto = await gastoFijoService.actualizarMonto(id, result.user.organizationId, montoCentavos, mesAnio)
    return NextResponse.json(monto)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo actualizar" }, { status: 400 })
  }
}
