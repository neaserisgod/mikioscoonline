import { prisma } from "@/lib/prisma"
import { calcularComision, calcularRecargo } from "@/domain/comisiones"
import { resolverCajaId } from "@/domain/cajas"
import { precioUnitarioEfectivo, costoUnitarioEfectivo, subtotalLinea } from "@/domain/pesables"

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface LineaVentaInput {
  productId: string
  cantidad: number
  /** Solo para productos pesables: gramos vendidos. */
  gramos?: number
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

      // 2. Validar stock (gramos para pesables, unidades para el resto)
      for (const linea of input.lineas) {
        const producto = productos.find((p) => p.id === linea.productId)!
        if (producto.esPesable) {
          const gramos = linea.gramos ?? 0
          if (gramos <= 0) {
            throw new Error(`Falta indicar el peso de "${producto.nombre}"`)
          }
          const disponible = producto.stockGramos ?? 0
          if (disponible < gramos) {
            throw new Error(
              `Stock insuficiente para "${producto.nombre}": disponible ${disponible}g, requerido ${gramos}g`
            )
          }
        } else if (producto.stock < linea.cantidad) {
          throw new Error(
            `Stock insuficiente para "${producto.nombre}": disponible ${producto.stock}, requerido ${linea.cantidad}`
          )
        }
      }

      // 2.5. Caja principal (siempre existe)
      const cajaPrincipal = await tx.caja.findFirstOrThrow({
        where: { organizationId: input.organizationId, esPrincipal: true },
        select: { id: true },
      })

      // 3. Construir líneas con costo-foto + totales (money-safe: ver domain/pesables)
      let totalCentavos = 0
      let costoTotalCentavos = 0
      const lineasConFoto = input.lineas.map((linea) => {
        const producto = productos.find((p) => p.id === linea.productId)!
        const precioUnitarioCentavos = precioUnitarioEfectivo(producto)
        const costoUnitarioCentavos = costoUnitarioEfectivo(producto)
        const gramos = producto.esPesable ? linea.gramos ?? 0 : null

        totalCentavos += subtotalLinea({ esPesable: producto.esPesable, precioUnitarioCentavos, cantidad: linea.cantidad, gramos })
        costoTotalCentavos += subtotalLinea({ esPesable: producto.esPesable, precioUnitarioCentavos: costoUnitarioCentavos, cantidad: linea.cantidad, gramos })

        return {
          productId: linea.productId,
          cantidad: producto.esPesable ? 1 : linea.cantidad,
          gramos,
          precioUnitarioCentavos,
          costoUnitarioCentavos,
        }
      })

      // 4. Split por categoría (atribución BASE, antes de overrides por medio de pago)
      const montoPorCajaCategoria = new Map<string, number>()
      for (const linea of input.lineas) {
        const producto = productos.find((p) => p.id === linea.productId)!
        const cajaId = resolverCajaId(producto.category.cajaId, cajaPrincipal.id)
        const precioUnitarioCentavos = precioUnitarioEfectivo(producto)
        const gramos = producto.esPesable ? linea.gramos ?? 0 : null
        const subtotal = subtotalLinea({ esPesable: producto.esPesable, precioUnitarioCentavos, cantidad: linea.cantidad, gramos })
        montoPorCajaCategoria.set(cajaId, (montoPorCajaCategoria.get(cajaId) ?? 0) + subtotal)
      }

      // 5. Medios de pago usados en esta venta (incluye cajaId: override de atribución)
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

      // 6. Cajas candidatas: las de categoría + las que algún medio de pago usado tenga como override
      const cajaIdsCategoria = [...montoPorCajaCategoria.keys()]
      const cajaIdsOverride = [...new Set(medios.map((m) => m.cajaId).filter((id): id is string => !!id))]
      const cajasCandidatas = [...new Set([...cajaIdsCategoria, ...cajaIdsOverride])]

      const cajasDetalle = await tx.caja.findMany({
        where: { id: { in: cajasCandidatas }, organizationId: input.organizationId },
        select: { id: true, nombre: true },
      })
      const cajaPorId = new Map(cajasDetalle.map((c) => [c.id, c]))

      // 7. Atribución final por caja: si el medio de pago tiene caja propia, esa porción va
      // entera ahí (override); si no, se reparte proporcional al split por categoría. El recargo
      // se calcula por medio de pago (no por caja — ver PaymentMethod) y se prorratea junto con
      // el ingreso que le corresponde a cada caja.
      const totalPagado = input.pagos.reduce((sum, p) => sum + p.montoCentavos, 0)
      const montoPorCaja = new Map<string, number>()
      const recargoPorCaja = new Map<string, number>()

      for (const pago of input.pagos) {
        const medio = medios.find((m) => m.id === pago.paymentMethodId)!
        const fraccion = totalPagado > 0 ? pago.montoCentavos / totalPagado : 0
        const ingresoPago = Math.round(totalCentavos * fraccion)
        const recargoPago = medio.esEfectivo ? 0 : calcularRecargo(medio, ingresoPago)

        if (medio.cajaId) {
          montoPorCaja.set(medio.cajaId, (montoPorCaja.get(medio.cajaId) ?? 0) + ingresoPago)
          if (recargoPago > 0) {
            recargoPorCaja.set(medio.cajaId, (recargoPorCaja.get(medio.cajaId) ?? 0) + recargoPago)
          }
        } else {
          for (const [cajaId, montoCategoria] of montoPorCajaCategoria) {
            const porcion = Math.round(montoCategoria * fraccion)
            montoPorCaja.set(cajaId, (montoPorCaja.get(cajaId) ?? 0) + porcion)
            if (recargoPago > 0 && totalCentavos > 0) {
              const recargoPorcion = Math.round((recargoPago * montoCategoria) / totalCentavos)
              recargoPorCaja.set(cajaId, (recargoPorCaja.get(cajaId) ?? 0) + recargoPorcion)
            }
          }
        }
      }

      const recargoCentavosTotal = [...recargoPorCaja.values()].reduce((sum, r) => sum + r, 0)

      // 7.5. Validar sesión abierta para cada caja que efectivamente recibe plata
      const cajasInvolucradas = [...montoPorCaja.keys()]
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

      // 8. Validar pago suficiente (productos + recargo virtual)
      if (totalPagado < totalCentavos + recargoCentavosTotal) {
        throw new Error(
          `Pago insuficiente: total a cobrar $${(totalCentavos + recargoCentavosTotal) / 100}, pagado $${totalPagado / 100}`
        )
      }

      // 9. Crear venta con líneas y pagos
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

      // 10. Descontar stock y crear movimientos (gramos para pesables, unidades para el resto)
      for (const linea of input.lineas) {
        const producto = productos.find((p) => p.id === linea.productId)!

        if (producto.esPesable) {
          const gramos = linea.gramos ?? 0
          const gramosAnterior = producto.stockGramos ?? 0
          const gramosPosterior = gramosAnterior - gramos

          await tx.product.update({
            where: { id: linea.productId },
            data: { stockGramos: gramosPosterior },
          })

          await tx.stockMovement.create({
            data: {
              productId: linea.productId,
              userId: input.userId,
              tipo: "SALIDA",
              cantidad: 0,
              stockAnterior: 0,
              stockPosterior: 0,
              gramos,
              gramosAnterior,
              gramosPosterior,
              saleId: venta.id,
              motivo: "Venta",
            },
          })
        } else {
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
      }

      // 11. Atribuir venta a cajas (un MovimientoCaja por caja involucrada)
      const medioPagoId = input.pagos[0].paymentMethodId
      for (const [cajaId, montoCentavos] of montoPorCaja) {
        const cajaSesionId = sesionPorCaja.get(cajaId)!
        const recargoCentavos = recargoPorCaja.get(cajaId) ?? 0

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
