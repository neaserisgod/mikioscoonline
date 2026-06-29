"use server"

import { auth } from "@/auth"
import { stockService } from "@/services/stock.service"
import { z } from "zod"

const EntradaSchema = z.object({
  productId: z.string().cuid(),
  cantidad: z.number().int().positive(),
  motivo: z.string().optional(),
})

const AjusteSchema = z.object({
  productId: z.string().cuid(),
  stockNuevo: z.number().int().min(0),
  motivo: z.string().optional(),
})

export async function entradaStockAction(input: unknown) {
  const session = await auth()
  if (!session?.user?.id || !session.user.organizationId) throw new Error("No autorizado")

  const { productId, cantidad, motivo } = EntradaSchema.parse(input)
  return stockService.registrarMovimiento({
    productId,
    userId: session.user.id,
    organizationId: session.user.organizationId,
    tipo: "ENTRADA",
    cantidad,
    motivo,
  })
}

/** Suma 1 unidad de stock vía escaneo — no requiere ADMIN */
export async function sumarStockEscanerAction(productId: string) {
  const session = await auth()
  if (!session?.user?.id || !session.user.organizationId) throw new Error("No autorizado")

  return stockService.registrarMovimiento({
    productId,
    userId: session.user.id,
    organizationId: session.user.organizationId,
    tipo: "ENTRADA",
    cantidad: 1,
    motivo: "Escaneo manual",
  })
}

export async function ajusteStockAction(input: unknown) {
  const session = await auth()
  if (!session?.user?.id || !session.user.organizationId) throw new Error("No autorizado")
  if (session.user.role !== "ADMIN") throw new Error("Solo ADMIN puede hacer ajustes de stock")

  const { productId, stockNuevo, motivo } = AjusteSchema.parse(input)
  return stockService.registrarMovimiento({
    productId,
    userId: session.user.id,
    organizationId: session.user.organizationId,
    tipo: "AJUSTE",
    cantidad: stockNuevo,
    motivo,
  })
}
