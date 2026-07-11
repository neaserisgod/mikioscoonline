import { prisma } from "@/lib/prisma"

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CrearCajaInput {
  nombre: string
}

export interface EditarCajaInput {
  nombre?: string
}

// ─── Helper interno ────────────────────────────────────────────────────────────

async function getPrincipal(organizationId: string) {
  return prisma.caja.findFirstOrThrow({ where: { organizationId, esPrincipal: true } })
}

// ─── Servicio ────────────────────────────────────────────────────────────────

export const cajaService = {
  /** Lista todas las cajas de la org con count de categorías asignadas y sesión abierta. */
  async listar(organizationId: string) {
    return prisma.caja.findMany({
      where: { organizationId },
      include: {
        _count: { select: { categories: true } },
        sesiones: {
          where: { estado: "ABIERTA" },
          take: 1,
          select: { id: true, fondoInicialCentavos: true, fechaApertura: true, abiertaPor: { select: { nombre: true } } },
        },
        categories: {
          where: { activo: true },
          select: { id: true, nombre: true },
          orderBy: { nombre: "asc" },
        },
      },
      orderBy: [{ esPrincipal: "desc" }, { orden: "asc" }],
    })
  },

  /** Crea una caja nueva. La principal ya existe siempre; nuevas cajas no pueden serlo. */
  async crear(organizationId: string, data: CrearCajaInput) {
    const maxOrden = await prisma.caja.aggregate({
      where: { organizationId },
      _max: { orden: true },
    })
    return prisma.caja.create({
      data: {
        nombre: data.nombre,
        esPrincipal: false,
        orden: (maxOrden._max.orden ?? 0) + 1,
        organizationId,
      },
    })
  },

  async editar(id: string, organizationId: string, data: EditarCajaInput) {
    await prisma.caja.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.caja.update({ where: { id }, data })
  },

  async desactivar(id: string, organizationId: string) {
    const caja = await prisma.caja.findFirstOrThrow({ where: { id, organizationId } })
    if (caja.esPrincipal) throw new Error("La caja principal no se puede desactivar")
    return prisma.caja.update({ where: { id }, data: { activo: false } })
  },

  async reactivar(id: string, organizationId: string) {
    await prisma.caja.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.caja.update({ where: { id }, data: { activo: true } })
  },

  /** Saldo real contado a mano (efectivo físico), para el equilibrio de Inicio. */
  async actualizarSaldoManual(id: string, organizationId: string, montoCentavos: number) {
    await prisma.caja.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.caja.update({
      where: { id },
      data: { saldoManualCentavos: montoCentavos, saldoManualActualizadoEn: new Date() },
    })
  },

  /**
   * Asigna un conjunto de categorías a esta caja.
   * Quita la asignación de las categorías que ya no están en la lista.
   * No toca categorías asignadas a otras cajas.
   */
  async asignarCategorias(cajaId: string, organizationId: string, categoriaIds: string[]) {
    await prisma.caja.findFirstOrThrow({ where: { id: cajaId, organizationId } })

    return prisma.$transaction([
      // Desasignar las que estaban en esta caja y ya no están en la lista
      prisma.category.updateMany({
        where: { cajaId, organizationId, id: { notIn: categoriaIds } },
        data: { cajaId: null },
      }),
      // Asignar las seleccionadas a esta caja
      ...(categoriaIds.length > 0
        ? [
            prisma.category.updateMany({
              where: { id: { in: categoriaIds }, organizationId },
              data: { cajaId },
            }),
          ]
        : []),
    ])
  },

  /** Obtiene la caja principal de la org. Siempre existe. */
  getPrincipal,

  /** Lista cajas activas con su sesión abierta (para el POS y la home). Para
   * las que no tienen sesión abierta, suma cuánto se contó al cerrar la
   * última — así "Abrir caja" puede sugerir ese monto como fondo inicial en
   * vez de arrancar en $0 (bug real: "Ventas QR/Posnet" perdió ~$1,38M del
   * saldo de Mercado Pago porque se reabrió con fondo $0 en vez de arrastrar
   * lo contado al cierre anterior — ver conversación del 2026-07-10). */
  async listarActivas(organizationId: string) {
    const cajas = await prisma.caja.findMany({
      where: { organizationId, activo: true },
      include: {
        sesiones: {
          where: { estado: "ABIERTA" },
          take: 1,
          select: {
            id: true,
            fondoInicialCentavos: true,
            fechaApertura: true,
            abiertaPor: { select: { nombre: true } },
            movimientos: {
              select: {
                tipo: true,
                montoCentavos: true,
                recargoCentavos: true,
                medioPago: { select: { esEfectivo: true } },
              },
            },
          },
        },
      },
      orderBy: [{ esPrincipal: "desc" }, { orden: "asc" }],
    })

    const sinAbrir = cajas.filter((c) => c.sesiones.length === 0)
    const ultimosCierres = await Promise.all(
      sinAbrir.map((c) =>
        prisma.cajaSesion.findFirst({
          where: { cajaId: c.id, estado: "CERRADA" },
          orderBy: { fechaCierre: "desc" },
          select: { efectivoContadoCentavos: true },
        })
      )
    )
    const cierrePorCaja = new Map(sinAbrir.map((c, i) => [c.id, ultimosCierres[i]?.efectivoContadoCentavos ?? null]))

    return cajas.map((c) => ({ ...c, ultimoCierreCentavos: cierrePorCaja.get(c.id) ?? null }))
  },
}
