import { prisma } from "@/lib/prisma"
import type { TipoMovimientoStock } from "@prisma/client"

export interface MovimientoManualInput {
  productId: string
  userId: string
  organizationId: string
  tipo: Extract<TipoMovimientoStock, "ENTRADA" | "AJUSTE">
  cantidad: number
  motivo?: string
}

export const stockService = {
  async registrarMovimiento(input: MovimientoManualInput) {
    const producto = await prisma.product.findFirstOrThrow({
      where: { id: input.productId, organizationId: input.organizationId },
    })

    const stockAnterior = producto.stock
    const stockPosterior =
      input.tipo === "ENTRADA"
        ? stockAnterior + input.cantidad
        : input.cantidad // AJUSTE: la cantidad es el nuevo stock

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
          cantidad: input.tipo === "AJUSTE" ? stockPosterior - stockAnterior : input.cantidad,
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
