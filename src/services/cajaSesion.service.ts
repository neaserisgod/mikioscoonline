import { prisma } from "@/lib/prisma"

export interface AbrirCajaInput {
  fondoInicialCentavos: number
}

export interface CerrarCajaInput {
  efectivoContadoCentavos: number
  nota?: string
}

export interface RegistrarMovimientoInput {
  tipo: "INGRESO" | "EGRESO"
  montoCentavos: number
  medioPagoId?: string
  nota?: string
}

const SESION_INCLUDE = {
  caja: { select: { nombre: true, esPrincipal: true } },
  abiertaPor: { select: { nombre: true } },
  cerradaPor: { select: { nombre: true } },
  movimientos: {
    select: {
      id: true,
      tipo: true,
      montoCentavos: true,
      recargoCentavos: true,
      nota: true,
      fecha: true,
      medioPago: { select: { nombre: true, esEfectivo: true } },
    },
    orderBy: { fecha: "asc" as const },
  },
} as const

function calcEfectivoEsperado(fondoInicialCentavos: number, movimientos: Array<{
  tipo: string
  montoCentavos: number
  medioPago: { esEfectivo: boolean } | null
}>): number {
  let total = fondoInicialCentavos
  for (const mov of movimientos) {
    if (mov.tipo === "INGRESO") {
      total += mov.montoCentavos
    } else if (mov.tipo === "EGRESO") {
      total -= mov.montoCentavos
    } else if (mov.tipo === "VENTA" && mov.medioPago?.esEfectivo) {
      total += mov.montoCentavos
    }
  }
  return total
}

export const cajaSesionService = {
  async abrirCaja(organizationId: string, cajaId: string, userId: string, fondoInicialCentavos: number, id?: string) {
    return prisma.$transaction(async (tx) => {
      // Replay idempotente: reintento de la cola offline de Flutter tras perder la
      // respuesta de un "abrir caja" que sí se proceso.
      if (id) {
        const existente = await tx.cajaSesion.findUnique({ where: { id }, include: SESION_INCLUDE })
        if (existente) return existente
      }

      const caja = await tx.caja.findFirstOrThrow({ where: { id: cajaId, organizationId } })

      const sesionAbierta = await tx.cajaSesion.findFirst({
        where: { cajaId, organizationId, estado: "ABIERTA" },
      })
      if (sesionAbierta) {
        throw new Error(`Abrí la ${caja.nombre} — ya tiene una sesión abierta`)
      }

      return tx.cajaSesion.create({
        data: {
          ...(id ? { id } : {}),
          cajaId,
          abiertaPorUserId: userId,
          fondoInicialCentavos,
          estado: "ABIERTA",
          organizationId,
        },
        include: SESION_INCLUDE,
      })
    })
  },

  async cerrarCaja(cajaSesionId: string, organizationId: string, userId: string, efectivoContadoCentavos: number, nota?: string) {
    return prisma.$transaction(async (tx) => {
      const sesion = await tx.cajaSesion.findFirstOrThrow({
        where: { id: cajaSesionId, organizationId },
      })

      // Idempotente: si un reintento de la cola offline llega después de que el
      // cierre ya se proceso, devolvemos la sesión tal cual en vez de tirar error.
      if (sesion.estado === "CERRADA") {
        return tx.cajaSesion.findFirstOrThrow({ where: { id: cajaSesionId }, include: SESION_INCLUDE })
      }

      const movimientos = await tx.movimientoCaja.findMany({
        where: { cajaSesionId },
        include: { medioPago: { select: { esEfectivo: true } } },
      })

      const efectivoEsperadoCentavos = calcEfectivoEsperado(sesion.fondoInicialCentavos, movimientos)
      const diferenciaCentavos = efectivoContadoCentavos - efectivoEsperadoCentavos

      return tx.cajaSesion.update({
        where: { id: cajaSesionId },
        data: {
          cerradaPorUserId: userId,
          fechaCierre: new Date(),
          efectivoEsperadoCentavos,
          efectivoContadoCentavos,
          diferenciaCentavos,
          nota: nota ?? null,
          estado: "CERRADA",
        },
        include: SESION_INCLUDE,
      })
    })
  },

  async registrarMovimiento(cajaSesionId: string, organizationId: string, data: RegistrarMovimientoInput, id?: string) {
    return prisma.$transaction(async (tx) => {
      if (id) {
        const existente = await tx.movimientoCaja.findUnique({ where: { id } })
        if (existente) return existente
      }

      const sesion = await tx.cajaSesion.findFirstOrThrow({
        where: { id: cajaSesionId, organizationId, estado: "ABIERTA" },
        select: { cajaId: true, caja: { select: { nombre: true } } },
      })
      if (data.medioPagoId) {
        await tx.paymentMethod.findFirstOrThrow({ where: { id: data.medioPagoId, organizationId } })
      }

      return tx.movimientoCaja.create({
        data: {
          ...(id ? { id } : {}),
          cajaSesionId,
          cajaId: sesion.cajaId,
          tipo: data.tipo,
          montoCentavos: data.montoCentavos,
          medioPagoId: data.medioPagoId ?? null,
          nota: data.nota ?? null,
          organizationId,
        },
      })
    })
  },

  async getSesionAbierta(cajaId: string, organizationId: string) {
    return prisma.cajaSesion.findFirst({
      where: { cajaId, organizationId, estado: "ABIERTA" },
      include: SESION_INCLUDE,
    })
  },

  /** Historial plano de movimientos (ventas, ingresos, egresos, ajustes) de
   * todas las cajas o de una en particular, para auditar sin tener que abrir
   * sesión por sesión. Filtrable por caja y rango de fechas. */
  async listarMovimientos(
    organizationId: string,
    filtros: { cajaId?: string; desde?: Date; hasta?: Date } = {}
  ) {
    return prisma.movimientoCaja.findMany({
      where: {
        organizationId,
        ...(filtros.cajaId ? { cajaId: filtros.cajaId } : {}),
        ...(filtros.desde || filtros.hasta
          ? {
              fecha: {
                ...(filtros.desde ? { gte: filtros.desde } : {}),
                ...(filtros.hasta ? { lte: filtros.hasta } : {}),
              },
            }
          : {}),
      },
      select: {
        id: true,
        tipo: true,
        montoCentavos: true,
        recargoCentavos: true,
        nota: true,
        fecha: true,
        caja: { select: { nombre: true } },
        medioPago: { select: { nombre: true, esEfectivo: true } },
        fixedExpense: { select: { nombre: true } },
        sale: { select: { id: true, esConsumoInterno: true } },
      },
      orderBy: { fecha: "desc" },
      take: 500,
    })
  },

  async listarHistorial(cajaId: string, organizationId: string, take = 20) {
    return prisma.cajaSesion.findMany({
      where: { cajaId, organizationId },
      include: {
        abiertaPor: { select: { nombre: true } },
        cerradaPor: { select: { nombre: true } },
        _count: { select: { movimientos: true } },
      },
      orderBy: { fechaApertura: "desc" },
      take,
    })
  },

  async getSesionById(cajaSesionId: string, organizationId: string) {
    return prisma.cajaSesion.findFirstOrThrow({
      where: { id: cajaSesionId, organizationId },
      include: SESION_INCLUDE,
    })
  },

  /** Cajas de efectivo (manejaEfectivo=true) con una sesión ABIERTA — el
   * cambio de perfil en el kiosco las bloquea hasta que se cierren (arqueo de
   * entrega de turno). Las cajas 100% digitales (ej. MercadoPago) no cuentan. */
  async listarCajasEfectivoAbiertas(organizationId: string) {
    const sesiones = await prisma.cajaSesion.findMany({
      where: { organizationId, estado: "ABIERTA", caja: { manejaEfectivo: true } },
      select: { caja: { select: { nombre: true } } },
    })
    return sesiones.map((s) => s.caja.nombre)
  },
}
