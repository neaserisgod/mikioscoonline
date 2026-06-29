import { z } from "zod"

export const movimientoStockSchema = z.object({
  productId: z.string().min(1, "El producto es obligatorio"),
  tipo: z.enum(["ENTRADA", "SALIDA", "AJUSTE"]),
  cantidad: z.number().int().min(1, "La cantidad debe ser al menos 1"),
  motivo: z.string().max(300).optional(),
})

export type MovimientoStockInput = z.infer<typeof movimientoStockSchema>
