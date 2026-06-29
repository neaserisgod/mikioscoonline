import { z } from "zod"

export const clienteSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(200),
  razonSocial: z.string().max(200).optional(),
  cuit: z.string().max(20).optional(),
  condicionIVA: z.enum([
    "RESPONSABLE_INSCRIPTO",
    "MONOTRIBUTO",
    "CONSUMIDOR_FINAL",
    "EXENTO",
  ]),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefono: z.string().max(50).optional(),
  direccion: z.string().max(300).optional(),
  activo: z.boolean(),
})

export type ClienteInput = z.infer<typeof clienteSchema>
