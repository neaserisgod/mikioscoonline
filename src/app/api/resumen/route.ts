import { NextRequest, NextResponse } from "next/server"
import { requireSessionApi } from "@/lib/api-auth"
import { resumenService } from "@/services/resumen.service"
import { productoService } from "@/services/producto.service"

export async function GET(req: NextRequest) {
  const result = await requireSessionApi()
  if ("error" in result) return result.error
  const { organizationId, role } = result.user

  const { searchParams } = req.nextUrl
  const mesParam = searchParams.get("mes") // "YYYY-MM" opcional

  // hoy/mes son cifras de ganancia — VENDEDOR no debe verlas, solo el stock bajo
  // (operativo, no financiero) le sirve para cualquiera.
  const [hoy, mes, stockBajo] = await Promise.all([
    role === "ADMIN" ? resumenService.hoy(organizationId) : null,
    role === "ADMIN"
      ? resumenService.mes(organizationId, mesParam ? new Date(`${mesParam}-01`) : undefined)
      : null,
    productoService.stockBajo(organizationId),
  ])

  return NextResponse.json({ hoy, mes, stockBajo })
}
