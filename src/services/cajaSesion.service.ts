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

const HORARIOS_ARQUEO_DEFAULT = "14:00,19:00"

/** Convierte "HH:mm,HH:mm" en horarios de HOY (Date), ordenados. */
function horariosDeHoy(horariosStr: string | null): Date[] {
  const horarios = (horariosStr ?? HORARIOS_ARQUEO_DEFAULT).split(",").map((h) => h.trim()).filter(Boolean)
  const hoy = new Date()
  return horarios
    .map((h) => {
      const [hh, mm] = h.split(":").map(Number)
      return new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), hh, mm, 0, 0)
    })
    .sort((a, b) => a.getTime() - b.getTime())
}

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

      // Cajas digitales (MP/QR/posnet) abren siempre en $0 a la vista, para
      // cualquier rol — no confiar en lo que mande el cliente. El saldo real
      // se arrastra por detrás desde el último cierre, para no "perder" el
      // acumulado (mismo bug real que documenta listarActivas en caja.service.ts).
      let fondoReal = fondoInicialCentavos
      if (!caja.manejaEfectivo) {
        const ultimoCierre = await tx.cajaSesion.findFirst({
          where: { cajaId, estado: "CERRADA" },
          orderBy: { fechaCierre: "desc" },
          select: { efectivoContadoCentavos: true },
        })
        fondoReal = ultimoCierre?.efectivoContadoCentavos ?? 0
      }

      return tx.cajaSesion.create({
        data: {
          ...(id ? { id } : {}),
          cajaId,
          abiertaPorUserId: userId,
          fondoInicialCentavos: fondoReal,
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

  /** Historial de arqueos parciales (conteos de control, no cierres) —
   * filtrable por caja, para revisar diferencias detectadas a lo largo del día. */
  async listarArqueosParciales(organizationId: string, filtros: { cajaId?: string } = {}, take = 50) {
    return prisma.arqueoParcial.findMany({
      where: { organizationId, ...(filtros.cajaId ? { cajaId: filtros.cajaId } : {}) },
      select: {
        id: true,
        efectivoEsperadoCentavos: true,
        efectivoContadoCentavos: true,
        diferenciaCentavos: true,
        nota: true,
        fecha: true,
        caja: { select: { nombre: true } },
        user: { select: { nombre: true } },
      },
      orderBy: { fecha: "desc" },
      take,
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

  /**
   * Conteo de control DENTRO de una sesión abierta — no la cierra ni le toca
   * el fondo/estado, solo deja constancia de esperado/contado/diferencia en
   * este momento. Mismo cálculo de esperado que un cierre real.
   */
  async registrarArqueoParcial(
    cajaSesionId: string,
    organizationId: string,
    userId: string,
    efectivoContadoCentavos: number,
    nota?: string
  ) {
    const sesion = await prisma.cajaSesion.findFirstOrThrow({
      where: { id: cajaSesionId, organizationId, estado: "ABIERTA" },
    })
    const movimientos = await prisma.movimientoCaja.findMany({
      where: { cajaSesionId },
      include: { medioPago: { select: { esEfectivo: true } } },
    })
    const efectivoEsperadoCentavos = calcEfectivoEsperado(sesion.fondoInicialCentavos, movimientos)
    const diferenciaCentavos = efectivoContadoCentavos - efectivoEsperadoCentavos

    return prisma.arqueoParcial.create({
      data: {
        cajaSesionId,
        cajaId: sesion.cajaId,
        userId,
        efectivoEsperadoCentavos,
        efectivoContadoCentavos,
        diferenciaCentavos,
        nota: nota ?? null,
        organizationId,
      },
    })
  },

  /**
   * Cajas de efectivo con sesión abierta que deben un arqueo parcial del
   * horario de control más reciente que ya pasó hoy (ver
   * Organization.horariosArqueo, default 14:00/19:00). Si ya se registró un
   * arqueo para esa sesión desde ese horario en adelante, no está pendiente
   * — no hace falta ponerse al día con horarios anteriores ya pasados.
   */
  async arqueosPendientes(organizationId: string) {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { horariosArqueo: true },
    })
    const horarios = horariosDeHoy(org.horariosArqueo)
    const ahora = new Date()
    const vencidos = horarios.filter((h) => h <= ahora)
    if (vencidos.length === 0) return []
    const ultimoVencido = vencidos[vencidos.length - 1]

    const cajas = await prisma.caja.findMany({
      where: { organizationId, activo: true, manejaEfectivo: true },
      select: {
        id: true,
        nombre: true,
        sesiones: { where: { estado: "ABIERTA" }, select: { id: true }, take: 1 },
      },
    })

    const pendientes: {
      cajaId: string; cajaNombre: string; cajaSesionId: string; horario: Date; efectivoEsperadoCentavos: number
    }[] = []
    for (const caja of cajas) {
      const sesionId = caja.sesiones[0]?.id
      if (!sesionId) continue
      const arqueoReciente = await prisma.arqueoParcial.findFirst({
        where: { cajaSesionId: sesionId, fecha: { gte: ultimoVencido } },
      })
      if (!arqueoReciente) {
        const sesion = await prisma.cajaSesion.findUniqueOrThrow({
          where: { id: sesionId },
          select: {
            fondoInicialCentavos: true,
            movimientos: { select: { tipo: true, montoCentavos: true, medioPago: { select: { esEfectivo: true } } } },
          },
        })
        const efectivoEsperadoCentavos = calcEfectivoEsperado(sesion.fondoInicialCentavos, sesion.movimientos)
        pendientes.push({
          cajaId: caja.id, cajaNombre: caja.nombre, cajaSesionId: sesionId, horario: ultimoVencido, efectivoEsperadoCentavos,
        })
      }
    }
    return pendientes
  },
}
