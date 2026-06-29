import { prisma } from "@/lib/prisma"
import { calcularComision } from "@/domain/comisiones"
import { resolverCajaId } from "@/domain/cajas"

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface LineaVentaInput {
  productId: string
  cantidad: number
}

export interface PagoInput {
  paymentMethodId: string
  montoCentavos: number
}

export interface CrearVentaInput {
  userId: string
  organizationId: string
  lineas: LineaVentaInput[]
  pagos: PagoInput[]
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

export const ventaService = {
  async crear(input: CrearVentaInput) {
    return prisma.$transaction(async (tx) => {
      // 1. Cargar productos con categoría (necesaria para resolver cajaId)
      const productIds = input.lineas.map((l) => l.productId)
      const productos = await tx.product.findMany({
        where: { id: { in: productIds }, organizationId: input.organizationId, activo: true },
        include: { category: { select: { cajaId: true } } },
      })

      if (productos.length !== productIds.length) {
        const encontrados = new Set(productos.map((p) => p.id))
        const faltantes = productIds.filter((id) => !encontrados.has(id))
        throw new Error(`Productos no encontrados: ${faltantes.join(", ")}`)
      }

      // 2. Validar stock
      for (const linea of input.lineas) {
        const producto = productos.find((p) => p.id === linea.productId)!
        if (producto.stock < linea.cantidad) {
          throw new Error(
            `Stock insuficiente para "${producto.nombre}": disponible ${producto.stock}, requerido ${linea.cantidad}`
          )
        }
      }

      // 2.5. Caja principal (siempre existe) + agrupar monto por caja
      const cajaPrincipal = await tx.caja.findFirstOrThrow({
        where: { organizationId: input.organizationId, esPrincipal: true },
        select: { id: true },
      })

      const montoPorCaja = new Map<string, number>()
      for (const linea of input.lineas) {
        const producto = productos.find((p) => p.id === linea.productId)!
        const cajaId = resolverCajaId(producto.category.cajaId, cajaPrincipal.id)
        montoPorCaja.set(cajaId, (montoPorCaja.get(cajaId) ?? 0) + producto.precioCentavos * linea.cantidad)
      }

      // 2.6. Cargar detalles de cajas (nombre para errores + config recargo)
      const cajasInvolucradas = [...montoPorCaja.keys()]
      const cajasDetalle = await tx.caja.findMany({
        where: { id: { in: cajasInvolucradas }, organizationId: input.organizationId },
        select: { id: true, nombre: true, recargoTipo: true, recargoVirtualBp: true, recargoVirtualFijoCentavos: true },
      })
      const cajaPorId = new Map(cajasDetalle.map((c) => [c.id, c]))

      // 2.7. Validar sesión abierta para cada caja involucrada
      const sesionesAbiertas = await tx.cajaSesion.findMany({
        where: { cajaId: { in: cajasInvolucradas }, estado: "ABIERTA", organizationId: input.organizationId },
        select: { id: true, cajaId: true },
      })
      const sesionPorCaja = new Map(sesionesAbiertas.map((s) => [s.cajaId, s.id]))

      for (const cajaId of cajasInvolucradas) {
        if (!sesionPorCaja.has(cajaId)) {
          const caja = cajaPorId.get(cajaId)
          throw new Error(`Abrí la ${caja?.nombre ?? "caja"} antes de confirmar la venta`)
        }
      }

      // 3. Construir líneas con costo-foto
      let totalCentavos = 0
      let costoTotalCentavos = 0
      const lineasConFoto = input.lineas.map((linea) => {
        const producto = productos.find((p) => p.id === linea.productId)!
        totalCentavos += producto.precioCentavos * linea.cantidad
        costoTotalCentavos += producto.costoCentavos * linea.cantidad
        return {
          productId: linea.productId,
          cantidad: linea.cantidad,
          precioUnitarioCentavos: producto.precioCentavos,
          costoUnitarioCentavos: producto.costoCentavos,
        }
      })

      // 4. Total pagado (validación en paso 5.6 luego de computar recargo virtual)
      const totalPagado = input.pagos.reduce((sum, p) => sum + p.montoCentavos, 0)

      // 5. Cargar medios de pago y calcular comisiones
      const medioIds = input.pagos.map((p) => p.paymentMethodId)
      const medios = await tx.paymentMethod.findMany({
        where: { id: { in: medioIds } },
      })
      if (medios.length !== new Set(medioIds).size) {
        throw new Error("Uno o más medios de pago no encontrados")
      }

      const pagosConComision = input.pagos.map((pago) => {
        const medio = medios.find((m) => m.id === pago.paymentMethodId)!
        const { comisionCentavos, montoNetoCentavos } = calcularComision(
          pago.montoCentavos,
          medio.comisionBp
        )
        return {
          paymentMethodId: pago.paymentMethodId,
          montoCentavos: pago.montoCentavos,
          comisionCentavos,
          montoNetoCentavos,
        }
      })

      // 5.5. Recargo virtual por caja (solo cuando el pago es no-efectivo)
      const medioPrincipal = medios.find((m) => m.id === input.pagos[0].paymentMethodId)!
      let recargoCentavosTotal = 0
      if (!medioPrincipal.esEfectivo) {
        for (const [cajaId, monto] of montoPorCaja) {
          const caja = cajaPorId.get(cajaId)!
          recargoCentavosTotal +=
            caja.recargoTipo === "PORCENTUAL"
              ? Math.round(monto * caja.recargoVirtualBp / 10_000)
              : caja.recargoVirtualFijoCentavos
        }
      }

      // 5.6. Validar pago suficiente (productos + recargo virtual)
      if (totalPagado < totalCentavos + recargoCentavosTotal) {
        throw new Error(
          `Pago insuficiente: total a cobrar $${(totalCentavos + recargoCentavosTotal) / 100}, pagado $${totalPagado / 100}`
        )
      }

      // 6. Crear venta con líneas y pagos
      const venta = await tx.sale.create({
        data: {
          userId: input.userId,
          organizationId: input.organizationId,
          totalCentavos,
          costoTotalCentavos,
          recargoCentavos: recargoCentavosTotal,
          lines: { create: lineasConFoto },
          payments: { create: pagosConComision },
        },
        include: {
          lines: { include: { product: true } },
          payments: { include: { paymentMethod: true } },
        },
      })

      // 7. Descontar stock y crear movimientos
      for (const linea of input.lineas) {
        const producto = productos.find((p) => p.id === linea.productId)!
        const stockPosterior = producto.stock - linea.cantidad

        await tx.product.update({
          where: { id: linea.productId },
          data: { stock: stockPosterior },
        })

        await tx.stockMovement.create({
          data: {
            productId: linea.productId,
            userId: input.userId,
            tipo: "SALIDA",
            cantidad: linea.cantidad,
            stockAnterior: producto.stock,
            stockPosterior,
            saleId: venta.id,
            motivo: "Venta",
          },
        })
      }

      // 8. Atribuir venta a cajas (un MovimientoCaja por caja involucrada)
      const medioPagoId = input.pagos[0].paymentMethodId
      for (const [cajaId, montoCentavos] of montoPorCaja) {
        const cajaSesionId = sesionPorCaja.get(cajaId)!
        const caja = cajaPorId.get(cajaId)!
        const recargoCentavos = medioPrincipal.esEfectivo ? 0
          : caja.recargoTipo === "PORCENTUAL"
            ? Math.round(montoCentavos * caja.recargoVirtualBp / 10_000)
            : caja.recargoVirtualFijoCentavos

        await tx.movimientoCaja.create({
          data: {
            cajaSesionId,
            cajaId,
            saleId: venta.id,
            tipo: "VENTA",
            montoCentavos,
            recargoCentavos,
            medioPagoId,
            organizationId: input.organizationId,
          },
        })
      }

      return venta
    })
  },

  async obtener(id: string, organizationId: string) {
    return prisma.sale.findFirst({
      where: { id, organizationId },
      include: {
        lines: { include: { product: { include: { category: true, provider: true } } } },
        payments: { include: { paymentMethod: true } },
        user: { select: { id: true, nombre: true, email: true } },
      },
    })
  },

  async listar(organizationId: string, opts?: { fechaDesde?: Date; fechaHasta?: Date; limit?: number }) {
    return prisma.sale.findMany({
      where: {
        organizationId,
        ...(opts?.fechaDesde || opts?.fechaHasta
          ? {
              fecha: {
                ...(opts.fechaDesde && { gte: opts.fechaDesde }),
                ...(opts.fechaHasta && { lte: opts.fechaHasta }),
              },
            }
          : {}),
      },
      include: {
        lines: true,
        payments: { include: { paymentMethod: true } },
        user: { select: { id: true, nombre: true } },
      },
      orderBy: { fecha: "desc" },
      take: opts?.limit ?? 100,
    })
  },
}
