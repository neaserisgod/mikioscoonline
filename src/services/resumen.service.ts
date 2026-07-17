import { prisma } from "@/lib/prisma"
import { calcularEquilibrio, type ResultadoEquilibrio } from "@/domain/equilibrio"
import { calcularReparto } from "@/domain/reparto"
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
  monotributoCentavos: number
  sueldoObjetivoCentavos: number
  /** Ganancia real del mes = bruta − comisiones − gastos fijos − monotributo −
   * sueldo objetivo (ver docs/MODELO-FINANCIERO.md). */
  gananciaNetaCentavos: number
  /** % de gastos fijos cubiertos — NO incluye monotributo ni sueldo objetivo,
   * es una medida aparte (ver domain/equilibrio.ts). */
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

    // Ventas del mes, gastos fijos, lo ya pagado de cada uno y los parámetros
    // del modelo financiero (monotributo/sueldo objetivo) son independientes — en paralelo
    const [ventas, gastosFijos, pagosGastosFijos, organizacion] = await Promise.all([
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
      prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { monotributoCentavos: true, sueldoObjetivoCentavos: true },
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
      monotributoCentavos: organizacion.monotributoCentavos,
      sueldoObjetivoCentavos: organizacion.sueldoObjetivoCentavos,
    })

    return {
      mesAnio,
      ventasCentavos,
      gananciaBrutaCentavos,
      comisionesTotalesCentavos,
      gastosFijosCentavos,
      monotributoCentavos: organizacion.monotributoCentavos,
      sueldoObjetivoCentavos: organizacion.sueldoObjetivoCentavos,
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
   * Cascada completa de reparto del efectivo disponible (ver
   * docs/MODELO-FINANCIERO.md, "¿Cuánta plata libre tengo hoy?"), en orden de
   * prioridad — cada paso solo gasta lo que dejó el anterior:
   *   1. Reposición de stock (piso por proveedor) — no es ganancia, es capital que gira.
   *   2. Deuda a proveedores por pagar (cuenta corriente).
   *   3. Gastos fijos pendientes del mes.
   *   4. Monotributo del mes.
   *   5. Sueldo objetivo (completo, ver domain/reparto.ts).
   * La aritmética vive en domain/reparto.ts (calcularReparto) — acá solo se
   * junta la data. Pensado para el caso de poca venta/poco efectivo: si no
   * alcanza para el paso 1, no hay nada más abajo en la cascada.
   */
  async reparto(organizationId: string, fecha?: Date) {
    const [equilibrio, proveedores, deudaProveedores, organizacion] = await Promise.all([
      resumenService.equilibrioReal(organizationId, fecha),
      prisma.provider.findMany({
        where: { organizationId, activo: true, pisoReposicionCentavos: { gt: 0 } },
        select: { id: true, nombre: true, pisoReposicionCentavos: true, saldoReposicionCentavos: true },
        orderBy: { nombre: "asc" },
      }),
      // Saldos negativos (se pagó de más) son informativos, no deuda real —
      // no restan acá (ver Provider.saldoCuentaCorrienteCentavos).
      prisma.provider.aggregate({
        where: { organizationId, activo: true, saldoCuentaCorrienteCentavos: { gt: 0 } },
        _sum: { saldoCuentaCorrienteCentavos: true },
      }),
      prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { monotributoCentavos: true, sueldoObjetivoCentavos: true },
      }),
    ])

    const reservaReposicionCentavos = proveedores.reduce((s, p) => s + p.pisoReposicionCentavos, 0)

    const resultado = calcularReparto({
      disponibleRealCentavos: equilibrio.disponibleRealCentavos,
      reservaReposicionCentavos,
      deudaProveedoresCentavos: deudaProveedores._sum.saldoCuentaCorrienteCentavos ?? 0,
      gastosFijosPendientesCentavos: equilibrio.mesActual.gastosFijosCentavos,
      monotributoCentavos: organizacion.monotributoCentavos,
      sueldoObjetivoCentavos: organizacion.sueldoObjetivoCentavos,
    })

    return {
      ...resultado,
      proveedoresPiso: proveedores,
    }
  },

  /**
   * Registra un retiro real de ganancia: crea un EGRESO en la caja elegida,
   * pero solo hasta lo que `reparto()` diga que es la ganancia real libre en
   * este momento — nunca deja tocar lo reservado para reposición, la deuda a
   * proveedores, los gastos fijos, el monotributo ni el sueldo objetivo (ver
   * la cascada completa en domain/reparto.ts). Recalcula el reparto en el
   * momento (no confía en un número que el cliente haya calculado antes) para
   * que no se pueda retirar de más con datos viejos.
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
