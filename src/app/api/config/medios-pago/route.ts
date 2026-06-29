import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { medioPagoService } from "@/services/config.service"

export async function GET() {
  const session = await auth()
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const data = await medioPagoService.listar(session.user.organizationId)
  return NextResponse.json(data)
}
