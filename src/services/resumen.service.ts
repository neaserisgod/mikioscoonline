import { prisma } from "@/lib/prisma"
import { calcularEquilibrio } from "@/domain/equilibrio"
import { inicioDia, finDia, inicioMes, finMes, toMesAnio } from "@/domain/dinero"

export interface ResumenHoy {
  ventasCentavos: number
  costoTotalCentavos: number
  gananciaBrutaCentavos: number
  cantidadVentas: number
  markupBp: number // markup promedio ponderado del día
  comisionesTotalesCentavos: number
  gananciaNeta: number
}

export interface ResumenMes {
  mesAnio: string
  ventasCentavos: number
  gananciaBrutaCentavos: number
  comisionesTotalesCentavos: number
  gastosFijosCentavos: number
  gananciaNetaCentavos: number
  pctAvance: number
  faltanteCentavos: number
  cubierto: boolean
}

export const resumenService = {
  async hoy(organizationId: string): Promise<ResumenHoy> {
    const ahora = new Date()
    const desde = inicioDia(ahora)
    const hasta = finDia(ahora)

    const ventas = await prisma.sale.findMany({
      where: { organizationId, fecha: { gte: desde, lte: hasta } },
      select: {
        totalCentavos: true,
        costoTotalCentavos: true,
        payments: { select: { comisionCentavos: true } },
      },
    })

    let ventasCentavos = 0
    let costoTotalCentavos = 0
    let comisionesTotalesCentavos = 0

    for (const venta of ventas) {
      ventasCentavos += venta.totalCentavos
      costoTotalCentavos += venta.costoTotalCentavos
      for (const pago of venta.payments) {
        comisionesTotalesCentavos += pago.comisionCentavos
      }
    }

    const gananciaBrutaCentavos = ventasCentavos - costoTotalCentavos
    const gananciaNeta = gananciaBrutaCentavos - comisionesTotalesCentavos

    const markupBp =
      costoTotalCentavos === 0
        ? 0
        : Math.round(((ventasCentavos - costoTotalCentavos) / costoTotalCentavos) * 10_000)

    return {
      ventasCentavos,
      costoTotalCentavos,
      gananciaBrutaCentavos,
      cantidadVentas: ventas.length,
      markupBp,
      comisionesTotalesCentavos,
      gananciaNeta,
    }
  },

  async mes(organizationId: string, fecha?: Date): Promise<ResumenMes> {
    const ref = fecha ?? new Date()
    const mesAnio = toMesAnio(ref)
    const desde = inicioMes(ref)
    const hasta = finMes(ref)

    // Ventas del mes
    const ventas = await prisma.sale.findMany({
      where: { organizationId, fecha: { gte: desde, lte: hasta } },
      select: {
        totalCentavos: true,
        costoTotalCentavos: true,
        payments: { select: { comisionCentavos: true } },
      },
    })

    let ventasCentavos = 0
    let costoTotalCentavos = 0
    let comisionesTotalesCentavos = 0

    for (const venta of ventas) {
      ventasCentavos += venta.totalCentavos
      costoTotalCentavos += venta.costoTotalCentavos
      for (const pago of venta.payments) {
        comisionesTotalesCentavos += pago.comisionCentavos
      }
    }

    const gananciaBrutaCentavos = ventasCentavos - costoTotalCentavos

    // Gastos fijos del mes: buscar FixedExpenseMonto de este mes o el monto más reciente anterior
    const gastosFijos = await prisma.fixedExpense.findMany({
      where: { organizationId, activo: true },
      select: {
        montos: {
          select: { mesAnio: true, montoCentavos: true },
          orderBy: { mesAnio: "desc" },
        },
      },
    })

    let gastosFijosCentavos = 0
    for (const gasto of gastosFijos) {
      // Preferir el monto de este mes, sino el más reciente que no supere este mes
      const montoMes =
        gasto.montos.find((m) => m.mesAnio === mesAnio) ??
        gasto.montos.find((m) => m.mesAnio <= mesAnio)
      if (montoMes) {
        gastosFijosCentavos += montoMes.montoCentavos
      }
    }

    const equilibrio = calcularEquilibrio({
      gastosFijosCentavos,
      gananciaBrutaCentavos,
      comisionesTotalesCentavos,
    })

    return {
      mesAnio,
      ventasCentavos,
      gananciaBrutaCentavos,
      comisionesTotalesCentavos,
      gastosFijosCentavos,
      gananciaNetaCentavos: equilibrio.gananciaNetaCentavos,
      pctAvance: equilibrio.pctAvance,
      faltanteCentavos: equilibrio.faltanteCentavos,
      cubierto: equilibrio.cubierto,
    }
  },
}
