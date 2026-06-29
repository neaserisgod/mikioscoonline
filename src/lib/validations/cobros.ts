import { z } from "zod"

export const cobroSchema = z.object({
  saleId: z.string().min(1, "La venta es obligatoria"),
  medio: z.enum(["EFECTIVO", "TRANSFERENCIA", "MERCADOPAGO", "CHEQUE", "OTROS"]),
  montoCentavos: z.number().int().min(1, "El monto debe ser mayor a 0"),
  referencia: z.string().max(200).optional(),
})

export type CobroInput = z.infer<typeof cobroSchema>
