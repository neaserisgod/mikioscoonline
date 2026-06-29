import { z } from "zod"

export const productoSchema = z.object({
  sku: z.string().min(1, "El SKU es obligatorio").max(50),
  name: z.string().min(1, "El nombre es obligatorio").max(200),
  descripcion: z.string().max(500).optional(),
  precioCentavos: z.number().int().min(0, "El precio no puede ser negativo"),
  costoCentavos: z.number().int().min(0),
  alicuotaIVA: z.number().refine((v) => [0, 10.5, 21].includes(v), {
    message: "Alícuota IVA debe ser 0, 10.5 o 21",
  }),
  stock: z.number().int().min(0),
  stockMinimo: z.number().int().min(0),
  activo: z.boolean(),
})

export type ProductoInput = z.infer<typeof productoSchema>
