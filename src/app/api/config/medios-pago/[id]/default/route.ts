import { NextRequest, NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/api-auth"
import { medioPagoService } from "@/services/config.service"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const { id } = await params
  try {
    await medioPagoService.setDefault(id, result.user.organizationId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo actualizar" }, { status: 400 })
  }
}
