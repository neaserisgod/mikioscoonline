import { prisma } from "@/lib/prisma"

export const customerService = {
  async listar(organizationId: string) {
    return prisma.customer.findMany({
      where: { organizationId },
      orderBy: { nombre: "asc" },
    })
  },

  async crear(organizationId: string, data: { nombre: string; telefono?: string; direccion?: string }) {
    return prisma.customer.create({ data: { ...data, organizationId } })
  },

  async editar(id: string, organizationId: string, data: { nombre: string; telefono?: string; direccion?: string }) {
    await prisma.customer.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.customer.update({ where: { id }, data })
  },

  async desactivar(id: string, organizationId: string) {
    await prisma.customer.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.customer.update({ where: { id }, data: { activo: false } })
  },

  async reactivar(id: string, organizationId: string) {
    await prisma.customer.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.customer.update({ where: { id }, data: { activo: true } })
  },

  /** Ventas fiadas de este cliente (con saldo pendiente o no), para el detalle
   * de cuenta corriente — más recientes primero. */
  async listarVentasFiadas(id: string, organizationId: string, take = 30) {
    await prisma.customer.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.sale.findMany({
      where: { customerId: id, organizationId, fiadoCentavos: { gt: 0 } },
      select: { id: true, fecha: true, totalCentavos: true, fiadoCentavos: true },
      orderBy: { fecha: "desc" },
      take,
    })
  },

  /** Cuenta corriente: cargar deuda a mano, sin pasar por una venta (ej. "fiar"
   * algo que no se cargó como venta, o un ajuste). Mismo patrón que
   * proveedorService.registrarCompraCuentaCorriente, invertido. */
  async registrarDeudaManual(id: string, organizationId: string, montoCentavos: number) {
    await prisma.customer.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.customer.update({
      where: { id },
      data: { saldoCuentaCorrienteCentavos: { increment: montoCentavos } },
    })
  },

  /** Cuenta corriente: pago de un cliente — baja lo que nos debe Y crea un
   * INGRESO real en la caja elegida (plata que efectivamente entró). Mismo
   * patrón que proveedorService.registrarPagoCuentaCorriente, invertido. */
  async registrarPagoDeuda(id: string, organizationId: string, montoCentavos: number, cajaId: string) {
    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirstOrThrow({ where: { id, organizationId } })
      const caja = await tx.caja.findFirstOrThrow({ where: { id: cajaId, organizationId } })
      const sesion = await tx.cajaSesion.findFirst({ where: { cajaId, estado: "ABIERTA" } })
      if (!sesion) throw new Error(`Abrí la ${caja.nombre} antes de registrar el pago`)

      await tx.movimientoCaja.create({
        data: {
          cajaSesionId: sesion.id,
          cajaId,
          tipo: "INGRESO",
          montoCentavos,
          nota: `Pago de cuenta corriente: ${customer.nombre}`,
          organizationId,
        },
      })

      // Nunca por debajo de $0 — un pago que supera lo que quedaba fiado no
      // genera saldo "a favor" del cliente, el INGRESO de arriba ya lo registra.
      return tx.customer.update({
        where: { id },
        data: { saldoCuentaCorrienteCentavos: Math.max(0, customer.saldoCuentaCorrienteCentavos - montoCentavos) },
      })
    })
  },
}
