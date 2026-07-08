import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminApi } from "@/lib/api-auth"
import { medioPagoService } from "@/services/config.service"

const Schema = z.object({ direccion: z.enum(["arriba", "abajo"]) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const { id } = await params
  try {
    const { direccion } = Schema.parse(await req.json())
    await medioPagoService.moverOrden(id, result.user.organizationId, direccion)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo mover" }, { status: 400 })
  }
}
