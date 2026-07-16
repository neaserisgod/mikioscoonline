import { prisma } from "@/lib/prisma"
import { calcularEquilibrio, type ResultadoEquilibrio } from "@/domain/equilibrio"
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

function claveDiaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export const resumenService = {
  /** Serie diaria de ganancia neta (bruta − comisiones) de los últimos `dias`
   * días, para el sparkline del Inicio. Cada día siempre presente (0 si no hubo
   * ventas), en orden cronológico. Excluye consumo interno. */
  async serieDiaria(organizationId: string, dias = 14): Promise<{ fecha: string; netoCentavos: number }[]> {
    const desde = inicioDia(new Date(Date.now() - (dias - 1) * 24 * 60 * 60 * 1000))
    const hasta = finDia(new Date())
    const ventas = await prisma.sale.findMany({
      where: { organizationId, fecha: { gte: desde, lte: hasta }, esConsumoInterno: false },
      select: {
        fecha: true,
        totalCentavos: true,
        costoTotalCentavos: true,
        payments: { select: { comisionCentavos: true } },
      },
    })

    const porDia = new Map<string, number>()
    for (let i = 0; i < dias; i++) {
      const d = new Date(desde)
      d.setDate(d.getDate() + i)
      porDia.set(claveDiaLocal(d), 0)
    }
    for (const v of ventas) {
      const key = claveDiaLocal(v.fecha)
      const comisiones = v.payments.reduce((s, p) => s + p.comisionCentavos, 0)
      const neto = v.totalCentavos - v.costoTotalCentavos - comisiones
      porDia.set(key, (porDia.get(key) ?? 0) + neto)
    }

    return [...porDia.entries()].map(([fecha, netoCentavos]) => ({ fecha, netoCentavos }))
  },

  async hoy(organizationId: string): Promise<ResumenHoy> {
    const ahora = new Date()
    const desde = inicioDia(ahora)
    const hasta = finDia(ahora)

    const ventas = await prisma.sale.findMany({
      where: { organizationId, fecha: { gte: desde, lte: hasta }, esConsumoInterno: false },
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

    // Ventas del mes, gastos fijos y lo ya pagado de cada uno son independientes — en paralelo
    const [ventas, gastosFijos, pagosGastosFijos] = await Promise.all([
      prisma.sale.findMany({
        where: { organizationId, fecha: { gte: desde, lte: hasta }, esConsumoInterno: false },
        select: {
          totalCentavos: true,
          costoTotalCentavos: true,
          payments: { select: { comisionCentavos: true } },
        },
      }),
      prisma.fixedExpense.findMany({
        where: { organizationId, activo: true },
        select: {
          id: true,
          montos: {
            select: { mesAnio: true, montoCentavos: true },
            orderBy: { mesAnio: "desc" },
          },
        },
      }),
      // EGRESOs de caja ya vinculados a un gasto fijo dentro del mes — se
      // descuentan del monto presupuestado para no contar dos veces la misma
      // plata (ya salió de la caja Y seguiría figurando como "a pagar").
      prisma.movimientoCaja.groupBy({
        by: ["fixedExpenseId"],
        where: { organizationId, tipo: "EGRESO", fixedExpenseId: { not: null }, fecha: { gte: desde, lte: hasta } },
        _sum: { montoCentavos: true },
      }),
    ])
    const pagadoPorGasto = new Map(pagosGastosFijos.map((p) => [p.fixedExpenseId, p._sum.montoCentavos ?? 0]))

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

    let gastosFijosCentavos = 0
    for (const gasto of gastosFijos) {
      // Preferir el monto de este mes, sino el más reciente que no supere este mes
      const montoMes =
        gasto.montos.find((m) => m.mesAnio === mesAnio) ??
        gasto.montos.find((m) => m.mesAnio <= mesAnio)
      if (montoMes) {
        const pagado = pagadoPorGasto.get(gasto.id) ?? 0
        gastosFijosCentavos += Math.max(0, montoMes.montoCentavos - pagado)
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

  /**
   * "Disponible real" = efectivo/saldo en cada caja relevante, calculado en vivo
   * desde los movimientos de su sesión abierta (fondo + ventas + ingresos −
   * egresos) — nada de esto se carga a mano. "Ventas QR/Posnet" ES el saldo de
   * Mercado Pago (su fondo inicial se ajustó una vez al saldo real de la cuenta;
   * de ahí en más solo sube o baja con ventas reales o con ingresos/egresos
   * manuales, igual que cualquier otra caja — no existe más un "checkpoint"
   * separado que sumar aparte, eso duplicaba la plata). "Caja Cigarrillos" sigue
   * afuera: esa plata está comprometida para pagarle en efectivo al proveedor
   * (ver el traspaso automático), no es plata disponible de verdad para cubrir
   * gastos del mes.
   */
  async equilibrioReal(
    organizationId: string,
    fecha?: Date
  ): Promise<{
    mesActual: ResumenMes
    cajas: { id: string; nombre: string; montoCentavos: number; actualizadoEn: Date | null }[]
    disponibleRealCentavos: number
    equilibrio: ResultadoEquilibrio
  }> {
    const [mesActual, cajas] = await Promise.all([
      resumenService.mes(organizationId, fecha),
      prisma.caja.findMany({
        where: { organizationId, activo: true, nombre: { not: "Caja Cigarrillos" } },
        select: { id: true, nombre: true },
        orderBy: [{ esPrincipal: "desc" }, { orden: "asc" }],
      }),
    ])

    const cajasConSaldo = await Promise.all(
      cajas.map(async (c) => {
        const sesion = await prisma.cajaSesion.findFirst({
          where: { cajaId: c.id, estado: "ABIERTA" },
          select: {
            fondoInicialCentavos: true,
            movimientos: { select: { tipo: true, montoCentavos: true } },
          },
        })
        const montoCentavos = sesion ? calcularTotalEnCaja(sesion.fondoInicialCentavos, sesion.movimientos) : 0
        return { id: c.id, nombre: c.nombre, montoCentavos, actualizadoEn: null }
      })
    )

    const disponibleRealCentavos = cajasConSaldo.reduce((sum, c) => sum + c.montoCentavos, 0)

    // Reutiliza calcularEquilibrio pasando el disponible real como "ganancia bruta" y
    // comisiones en 0 — ya es el neto contado a mano, no hay nada más que restarle.
    const equilibrio = calcularEquilibrio({
      gastosFijosCentavos: mesActual.gastosFijosCentavos,
      gananciaBrutaCentavos: disponibleRealCentavos,
      comisionesTotalesCentavos: 0,
    })

    return { mesActual, cajas: cajasConSaldo, disponibleRealCentavos, equilibrio }
  },

  /**
   * Cascada de reparto del efectivo disponible, en orden de prioridad:
   *   1. Gastos fijos pendientes del mes — se cubren primero, sin excepción.
   *   2. Piso de reinversión de cada proveedor (colchón fijo cargado a mano,
   *      no se resetea cada mes — ver Provider.pisoReposicionCentavos).
   *   3. Ganancia limpia — lo que sobra después de 1 y 2, recién ahí es
   *      "plata propia" que se puede transferir/retirar sin arriesgar stock
   *      ni gastos fijos.
   * Pensado para el caso de poca venta/poco efectivo: si no alcanza para 1,
   * no hay ni reposición ni ganancia — todo el disponible es "para gastos fijos".
   */
  async reparto(organizationId: string, fecha?: Date) {
    const [equilibrio, proveedores] = await Promise.all([
      resumenService.equilibrioReal(organizationId, fecha),
      prisma.provider.findMany({
        where: { organizationId, activo: true, pisoReposicionCentavos: { gt: 0 } },
        select: { id: true, nombre: true, pisoReposicionCentavos: true, saldoReposicionCentavos: true },
        orderBy: { nombre: "asc" },
      }),
    ])

    const { disponibleRealCentavos } = equilibrio
    const gastosFijosPendientesCentavos = equilibrio.mesActual.gastosFijosCentavos
    const gastosFijosCubiertos = disponibleRealCentavos >= gastosFijosPendientesCentavos
    const gastosFijosFaltanteCentavos = Math.max(0, gastosFijosPendientesCentavos - disponibleRealCentavos)

    const disponibleTrasGastosCentavos = Math.max(0, disponibleRealCentavos - gastosFijosPendientesCentavos)
    const reservaReposicionCentavos = proveedores.reduce((s, p) => s + p.pisoReposicionCentavos, 0)
    const reposicionCubierta = disponibleTrasGastosCentavos >= reservaReposicionCentavos
    const reposicionFaltanteCentavos = Math.max(0, reservaReposicionCentavos - disponibleTrasGastosCentavos)

    const gananciaDisponibleCentavos = Math.max(0, disponibleTrasGastosCentavos - reservaReposicionCentavos)

    return {
      disponibleRealCentavos,
      gastosFijosPendientesCentavos,
      gastosFijosCubiertos,
      gastosFijosFaltanteCentavos,
      reservaReposicionCentavos,
      reposicionCubierta,
      reposicionFaltanteCentavos,
      proveedoresPiso: proveedores,
      gananciaDisponibleCentavos,
    }
  },

  /**
   * Registra un retiro real de ganancia: crea un EGRESO en la caja elegida,
   * pero solo hasta lo que `reparto()` diga que es "ganancia limpia
   * disponible" en este momento — nunca deja tocar lo reservado para gastos
   * fijos o para el piso de reposición de los proveedores. Recalcula el
   * reparto en el momento (no confía en un número que el cliente haya
   * calculado antes) para que no se pueda retirar de más con datos viejos.
   */
  async retirarGanancia(organizationId: string, montoCentavos: number, cajaId: string) {
    const actual = await resumenService.reparto(organizationId)
    if (montoCentavos > actual.gananciaDisponibleCentavos) {
      const disponible = (actual.gananciaDisponibleCentavos / 100).toFixed(2)
      throw new Error(`Solo hay $${disponible} de ganancia limpia disponible para retirar`)
    }

    return prisma.$transaction(async (tx) => {
      const caja = await tx.caja.findFirstOrThrow({ where: { id: cajaId, organizationId } })
      const sesion = await tx.cajaSesion.findFirst({ where: { cajaId, estado: "ABIERTA" } })
      if (!sesion) throw new Error(`Abrí la ${caja.nombre} antes de retirar`)

      return tx.movimientoCaja.create({
        data: {
          cajaSesionId: sesion.id,
          cajaId,
          tipo: "EGRESO",
          montoCentavos,
          nota: "Retiro de ganancia",
          organizationId,
        },
      })
    })
  },
}

function calcularTotalEnCaja(
  fondoInicialCentavos: number,
  movimientos: { tipo: string; montoCentavos: number }[]
): number {
  let total = fondoInicialCentavos
  for (const m of movimientos) {
    if (m.tipo === "INGRESO") total += m.montoCentavos
    else if (m.tipo === "EGRESO") total -= m.montoCentavos
    else if (m.tipo === "VENTA") total += m.montoCentavos
  }
  return total
}
