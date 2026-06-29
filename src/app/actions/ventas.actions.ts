"use server"

import { auth } from "@/auth"
import { ventaService } from "@/services/venta.service"
import { z } from "zod"

const LineaSchema = z.object({
  productId: z.string().cuid(),
  cantidad: z.number().int().positive(),
})

const PagoSchema = z.object({
  paymentMethodId: z.string().cuid(),
  montoCentavos: z.number().int().positive(),
})

const CrearVentaSchema = z.object({
  lineas: z.array(LineaSchema).min(1, "La venta debe tener al menos una línea"),
  pagos: z.array(PagoSchema).min(1, "La venta debe tener al menos un pago"),
})

export async function crearVentaAction(input: unknown) {
  const session = await auth()
  if (!session?.user?.id || !session.user.organizationId) throw new Error("No autorizado")

  const { lineas, pagos } = CrearVentaSchema.parse(input)

  return ventaService.crear({
    userId: session.user.id,
    organizationId: session.user.organizationId,
    lineas,
    pagos,
  })
}
