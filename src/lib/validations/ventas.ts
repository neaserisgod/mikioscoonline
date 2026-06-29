import { z } from "zod"

export const itemVentaSchema = z.object({
  productId: z.string().min(1),
  cantidad: z.number().int().min(1, "La cantidad debe ser al menos 1"),
  precioUnitarioCentavos: z.number().int().min(0),
})

export const ventaSchema = z.object({
  clientId: z.string().min(1, "El cliente es obligatorio"),
  items: z.array(itemVentaSchema).min(1, "La venta debe tener al menos un ítem"),
  observaciones: z.string().max(500).optional(),
})

export type ItemVentaInput = z.infer<typeof itemVentaSchema>
export type VentaInput = z.infer<typeof ventaSchema>
