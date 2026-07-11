import { prisma } from "@/lib/prisma"
import type { TipoMovimientoStock } from "@prisma/client"

export interface MovimientoManualInput {
  productId: string
  userId: string
  organizationId: string
  tipo: Extract<TipoMovimientoStock, "ENTRADA" | "AJUSTE">
  /** Unidades (o gramos si el producto es pesable — ver domain/pesables). */
  cantidad: number
  motivo?: string
}

export const stockService = {
  async registrarMovimiento(input: MovimientoManualInput) {
    const producto = await prisma.product.findFirstOrThrow({
      where: { id: input.productId, organizationId: input.organizationId },
    })

    if (producto.esPesable) {
      if (input.tipo === "ENTRADA") {
        // Incremento atómico — no depende del valor leído arriba, así que una venta
        // concurrente entre la lectura y el guardado no se pisa (a diferencia de sumar
        // en JS y guardar un valor absoluto).
        return prisma.$transaction(async (tx) => {
          const actualizado = await tx.product.update({
            where: { id: input.productId },
            data: { stockGramos: { increment: input.cantidad } },
            select: { stockGramos: true },
          })
          const gramosPosterior = actualizado.stockGramos ?? 0
          const gramosAnterior = gramosPosterior - input.cantidad

          const movimiento = await tx.stockMovement.create({
            data: {
              productId: input.productId,
              userId: input.userId,
              tipo: input.tipo,
              cantidad: 0,
              stockAnterior: 0,
              stockPosterior: 0,
              gramos: input.cantidad,
              gramosAnterior,
              gramosPosterior,
              motivo: input.motivo,
            },
          })

          // Esta entrada es la compra real al proveedor — descuenta del fondo de
          // reposición lo que ya se había apartado para reponer este producto.
          if (producto.providerId) {
            const costoRecibidoCentavos = Math.round(
              ((producto.costoPorKgCentavos ?? 0) * input.cantidad) / 1000
            )
            await tx.provider.update({
              where: { id: producto.providerId },
              data: { saldoReposicionCentavos: { decrement: costoRecibidoCentavos } },
            })
          }

          return movimiento
        })
      }

      // AJUSTE: es un conteo físico — el nuevo valor absoluto debe pisar cualquier
      // cambio concurrente (es la fuente de verdad más reciente), no sumarse/restarse.
      const gramosAnterior = producto.stockGramos ?? 0
      const gramosPosterior = input.cantidad
      if (gramosPosterior < 0) {
        throw new Error(`Stock resultante no puede ser negativo: ${gramosPosterior}g`)
      }

      return prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: input.productId },
          data: { stockGramos: gramosPosterior },
        })

        return tx.stockMovement.create({
          data: {
            productId: input.productId,
            userId: input.userId,
            tipo: input.tipo,
            cantidad: 0,
            stockAnterior: 0,
            stockPosterior: 0,
            gramos: gramosPosterior - gramosAnterior,
            gramosAnterior,
            gramosPosterior,
            motivo: input.motivo,
          },
        })
      })
    }

    if (input.tipo === "ENTRADA") {
      return prisma.$transaction(async (tx) => {
        const actualizado = await tx.product.update({
          where: { id: input.productId },
          data: { stock: { increment: input.cantidad } },
          select: { stock: true },
        })
        const stockPosterior = actualizado.stock
        const stockAnterior = stockPosterior - input.cantidad

        const movimiento = await tx.stockMovement.create({
          data: {
            productId: input.productId,
            userId: input.userId,
            tipo: input.tipo,
            cantidad: input.cantidad,
            stockAnterior,
            stockPosterior,
            motivo: input.motivo,
          },
        })

        // Esta entrada es la compra real al proveedor — descuenta del fondo de
        // reposición lo que ya se había apartado para reponer este producto.
        if (producto.providerId) {
          const costoRecibidoCentavos = producto.costoCentavos * input.cantidad
          await tx.provider.update({
            where: { id: producto.providerId },
            data: { saldoReposicionCentavos: { decrement: costoRecibidoCentavos } },
          })
        }

        return movimiento
      })
    }

    // AJUSTE: mismo razonamiento que en el caso pesable — set absoluto intencional.
    const stockAnterior = producto.stock
    const stockPosterior = input.cantidad
    if (stockPosterior < 0) {
      throw new Error(`Stock resultante no puede ser negativo: ${stockPosterior}`)
    }

    return prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: input.productId },
        data: { stock: stockPosterior },
      })

      return tx.stockMovement.create({
        data: {
          productId: input.productId,
          userId: input.userId,
          tipo: input.tipo,
          cantidad: stockPosterior - stockAnterior,
          stockAnterior,
          stockPosterior,
          motivo: input.motivo,
        },
      })
    })
  },

  async historial(
    productId: string,
    organizationId: string,
    opts?: { limit?: number }
  ) {
    // Verificar que el producto pertenece a la org
    await prisma.product.findFirstOrThrow({ where: { id: productId, organizationId } })

    return prisma.stockMovement.findMany({
      where: { productId },
      include: { user: { select: { id: true, nombre: true } } },
      orderBy: { creadoEn: "desc" },
      take: opts?.limit ?? 50,
    })
  },

  async listarTodos(organizationId: string, opts?: { limit?: number }) {
    return prisma.stockMovement.findMany({
      where: { product: { organizationId } },
      include: {
        product: { select: { id: true, nombre: true, sku: true } },
        user: { select: { id: true, nombre: true } },
      },
      orderBy: { creadoEn: "desc" },
      take: opts?.limit ?? 100,
    })
  },
}
