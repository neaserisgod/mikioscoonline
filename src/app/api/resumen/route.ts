import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { resumenService } from "@/services/resumen.service"
import { productoService } from "@/services/producto.service"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const mesParam = searchParams.get("mes") // "YYYY-MM" opcional

  const [hoy, mes, stockBajo] = await Promise.all([
    resumenService.hoy(session.user.organizationId),
    resumenService.mes(
      session.user.organizationId,
      mesParam ? new Date(`${mesParam}-01`) : undefined
    ),
    productoService.stockBajo(session.user.organizationId),
  ])

  return NextResponse.json({ hoy, mes, stockBajo })
}
