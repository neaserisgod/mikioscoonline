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
  async abrirCaja(organizationId: string, cajaId: string, userId: string, fondoInicialCentavos: number) {
    return prisma.$transaction(async (tx) => {
      const caja = await tx.caja.findFirstOrThrow({ where: { id: cajaId, organizationId } })

      const sesionAbierta = await tx.cajaSesion.findFirst({
        where: { cajaId, organizationId, estado: "ABIERTA" },
      })
      if (sesionAbierta) {
        throw new Error(`Abrí la ${caja.nombre} — ya tiene una sesión abierta`)
      }

      return tx.cajaSesion.create({
        data: {
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
        where: { id: cajaSesionId, organizationId, estado: "ABIERTA" },
      })

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

  async registrarMovimiento(cajaSesionId: string, organizationId: string, data: RegistrarMovimientoInput) {
    const sesion = await prisma.cajaSesion.findFirstOrThrow({
      where: { id: cajaSesionId, organizationId, estado: "ABIERTA" },
      select: { cajaId: true, caja: { select: { nombre: true } } },
    })
    if (data.medioPagoId) {
      await prisma.paymentMethod.findFirstOrThrow({ where: { id: data.medioPagoId, organizationId } })
    }

    return prisma.movimientoCaja.create({
      data: {
        cajaSesionId,
        cajaId: sesion.cajaId,
        tipo: data.tipo,
        montoCentavos: data.montoCentavos,
        medioPagoId: data.medioPagoId ?? null,
        nota: data.nota ?? null,
        organizationId,
      },
    })
  },

  async getSesionAbierta(cajaId: string, organizationId: string) {
    return prisma.cajaSesion.findFirst({
      where: { cajaId, organizationId, estado: "ABIERTA" },
      include: SESION_INCLUDE,
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
}
