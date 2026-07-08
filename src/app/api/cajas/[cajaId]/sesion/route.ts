import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionApi } from "@/lib/api-auth"
import { cajaSesionService } from "@/services/cajaSesion.service"

export async function GET(_req: Request, { params }: { params: Promise<{ cajaId: string }> }) {
  const result = await requireSessionApi()
  if ("error" in result) return result.error
  const { cajaId } = await params
  const data = await cajaSesionService.getSesionAbierta(cajaId, result.user.organizationId)
  return NextResponse.json(data)
}

const AbrirSchema = z.object({
  fondoInicialCentavos: z.number().int().min(0),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ cajaId: string }> }) {
  const result = await requireSessionApi()
  if ("error" in result) return result.error

  const body = await req.json().catch(() => null)
  const parsed = AbrirSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 })
  }

  const { cajaId } = await params
  try {
    const sesion = await cajaSesionService.abrirCaja(
      result.user.organizationId,
      cajaId,
      result.user.id,
      parsed.data.fondoInicialCentavos
    )
    return NextResponse.json(sesion)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo abrir la caja" }, { status: 400 })
  }
}
