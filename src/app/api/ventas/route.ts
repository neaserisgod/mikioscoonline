import { NextRequest, NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/api-auth"
import { ventaService } from "@/services/venta.service"
import { parseFechaQuery, finDia } from "@/domain/dinero"

type VentaListado = Awaited<ReturnType<typeof ventaService.listarPaginado>>["ventas"][number]

function mapVenta(v: VentaListado) {
  const aCobrar = v.totalCentavos - v.fiadoCentavos
  const flags = {
    sinLineas: v._count.lines === 0,
    sinStock: v._count.lines > 0 && v._count.stockMovements === 0,
    sinPago: aCobrar > 0 && v._count.payments === 0,
    sinMovimientoCaja: aCobrar > 0 && v._count.movimientosCaja === 0,
  }
  return {
    id: v.id,
    fecha: v.fecha,
    usuario: v.user.nombre || v.user.email,
    totalCentavos: v.totalCentavos,
    costoTotalCentavos: v.costoTotalCentavos,
    descuentoCentavos: v.descuentoCentavos,
    recargoCentavos: v.recargoCentavos,
    fiadoCentavos: v.fiadoCentavos,
    esConsumoInterno: v.esConsumoInterno,
    cliente: v.customer?.nombre ?? null,
    medios: v.payments.map((p) => ({ nombre: p.paymentMethod.nombre, esEfectivo: p.paymentMethod.esEfectivo, montoCentavos: p.montoCentavos })),
    cantidadLineas: v._count.lines,
    cantidadPagos: v._count.payments,
    cantidadMovimientosCaja: v._count.movimientosCaja,
    cantidadStockMovements: v._count.stockMovements,
    comprobante: v.comprobante ? { estado: v.comprobante.estado, tipo: v.comprobante.tipo, numero: v.comprobante.numero } : null,
    flags,
    tieneProblema: flags.sinLineas || flags.sinStock || flags.sinPago || flags.sinMovimientoCaja,
  }
}

export async function GET(req: NextRequest) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error

  const { searchParams } = req.nextUrl
  const desde = parseFechaQuery(searchParams.get("desde"))
  const hastaParam = parseFechaQuery(searchParams.get("hasta"))
  if (desde === null || hastaParam === null) {
    return NextResponse.json({ error: "Fecha inválida en desde/hasta" }, { status: 400 })
  }
  const hasta = hastaParam ? finDia(hastaParam) : hastaParam
  const medioPagoId = searchParams.get("medioPagoId") || undefined
  const facturaEstadoParam = searchParams.get("facturaEstado")
  const facturaEstado =
    facturaEstadoParam === "EMITIDO" || facturaEstadoParam === "ERROR" || facturaEstadoParam === "SIN_FACTURAR"
      ? facturaEstadoParam
      : undefined
  const soloProblemas = searchParams.get("soloProblemas") === "1"
  const page = Math.max(1, Number(searchParams.get("page")) || 1)
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize")) || 50))

  if (!soloProblemas) {
    const { ventas, total } = await ventaService.listarPaginado(result.user.organizationId, {
      fechaDesde: desde,
      fechaHasta: hasta,
      medioPagoId,
      facturaEstado,
      page,
      pageSize,
    })
    return NextResponse.json({ ventas: ventas.map(mapVenta), total, page, pageSize })
  }

  // "Solo con inconsistencias" filtra por un flag calculado (no una columna),
  // así que no se puede paginar en SQL — traemos todo lo que matchea
  // fecha/medio y filtramos/paginamos acá. El dataset de un kiosco es chico,
  // no hace falta optimizar esto.
  const { ventas: todas } = await ventaService.listarPaginado(result.user.organizationId, {
    fechaDesde: desde,
    fechaHasta: hasta,
    medioPagoId,
    facturaEstado,
    page: 1,
    pageSize: 100_000,
  })
  const conProblema = todas.map(mapVenta).filter((v) => v.tieneProblema)
  const total = conProblema.length
  const inicio = (page - 1) * pageSize
  return NextResponse.json({ ventas: conProblema.slice(inicio, inicio + pageSize), total, page, pageSize })
}
