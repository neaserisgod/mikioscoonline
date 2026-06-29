import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { cajaSesionService } from "@/services/cajaSesion.service"

export async function GET(_req: Request, { params }: { params: Promise<{ cajaId: string }> }) {
  const session = await auth()
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const { cajaId } = await params
  const data = await cajaSesionService.getSesionAbierta(cajaId, session.user.organizationId)
  return NextResponse.json(data)
}
