import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionApi } from "@/lib/api-auth"
import { cajaSesionService } from "@/services/cajaSesion.service"

const MovimientoSchema = z.object({
  // Id generado por el cliente (uuid v4) para reintentos idempotentes desde la cola offline.
  id: z.string().min(8).max(64).optional(),
  tipo: z.enum(["INGRESO", "EGRESO"]),
  montoCentavos: z.number().int().min(1, "El monto debe ser mayor a 0"),
  medioPagoId: z.string().optional(),
  nota: z.string().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ cajaSesionId: string }> }) {
  const result = await requireSessionApi()
  if ("error" in result) return result.error

  const body = await req.json().catch(() => null)
  const parsed = MovimientoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 })
  }

  const { cajaSesionId } = await params
  try {
    const { id, ...data } = parsed.data
    const movimiento = await cajaSesionService.registrarMovimiento(
      cajaSesionId,
      result.user.organizationId,
      data,
      id
    )
    return NextResponse.json(movimiento)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo registrar el movimiento" }, { status: 400 })
  }
}
