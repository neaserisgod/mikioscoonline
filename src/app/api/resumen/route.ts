import { NextRequest, NextResponse } from "next/server"
import { requireSessionApi } from "@/lib/api-auth"
import { resumenService } from "@/services/resumen.service"
import { productoService } from "@/services/producto.service"
import { parseFechaQuery } from "@/domain/dinero"

export async function GET(req: NextRequest) {
  const result = await requireSessionApi()
  if ("error" in result) return result.error
  const { organizationId, role } = result.user

  const { searchParams } = req.nextUrl
  const mesParam = searchParams.get("mes") // "YYYY-MM" opcional
  const mesFecha = mesParam ? parseFechaQuery(`${mesParam}-01`) : undefined
  if (mesFecha === null) {
    return NextResponse.json({ error: "Parámetro mes inválido (esperado YYYY-MM)" }, { status: 400 })
  }

  // hoy/mes son cifras de ganancia — VENDEDOR no debe verlas, solo el stock bajo
  // (operativo, no financiero) le sirve para cualquiera.
  const [hoy, real, reparto, valorInventario, stockBajo, serie] = await Promise.all([
    role === "ADMIN" ? resumenService.hoy(organizationId) : null,
    role === "ADMIN" ? resumenService.equilibrioReal(organizationId, mesFecha) : null,
    role === "ADMIN" ? resumenService.reparto(organizationId, mesFecha) : null,
    role === "ADMIN" ? productoService.valorInventario(organizationId) : null,
    productoService.stockBajo(organizationId),
    role === "ADMIN" ? resumenService.serieDiaria(organizationId, 14) : null,
  ])

  return NextResponse.json({
    hoy,
    mes: real?.mesActual ?? null,
    cajas: real?.cajas ?? null,
    disponibleRealCentavos: real?.disponibleRealCentavos ?? null,
    equilibrio: real?.equilibrio ?? null,
    reparto,
    valorInventario,
    stockBajo,
    serie,
  })
}
