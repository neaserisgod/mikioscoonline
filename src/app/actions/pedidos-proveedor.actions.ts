"use server"

import { auth } from "@/auth"
import { Prisma } from "@prisma/client"
import { z, ZodError } from "zod"
import { pedidoProveedorService } from "@/services/pedido-proveedor.service"

const LineaPedidoSchema = z.object({
  productId: z.string().min(1),
  cantidad: z.number().int().positive(),
  montoTotalCentavos: z.number().int().positive(),
  precioVentaCentavos: z.number().int().positive().optional(),
})

const IngresarPedidoSchema = z
  .object({
    providerId: z.string().min(1),
    lineas: z.array(LineaPedidoSchema).min(1, "Agregá al menos una línea"),
    ivaCentavos: z.number().int().min(0).optional(),
    otrosImpuestosCentavos: z.number().int().min(0).optional(),
    montoPagadoCentavos: z.number().int().min(0),
    cajaId: z.string().min(1).optional(),
  })
  .refine((d) => d.montoPagadoCentavos === 0 || !!d.cajaId, {
    message: "Elegí una caja para registrar el pago",
    path: ["cajaId"],
  })

type IngresarPedidoResult = { ok: true; totalCentavos: number } | { ok: false; error: string }

function mensajeError(e: unknown): string {
  if (e instanceof ZodError) return e.issues.map((i) => i.message).join(" · ")
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return "No se pudo registrar el pedido (error de base de datos)"
  }
  if (e instanceof Error) return e.message
  return "No se pudo registrar el pedido"
}

export async function ingresarPedidoProveedorAction(input: unknown): Promise<IngresarPedidoResult> {
  try {
    const session = await auth()
    if (!session?.user?.organizationId) return { ok: false, error: "No autorizado" }
    if (session.user.role !== "ADMIN") return { ok: false, error: "Solo ADMIN puede cargar pedidos" }

    const parsed = IngresarPedidoSchema.parse(input)
    const { totalPedidoCentavos } = await pedidoProveedorService.ingresar({
      ...parsed,
      userId: session.user.id,
      organizationId: session.user.organizationId,
    })
    return { ok: true, totalCentavos: totalPedidoCentavos }
  } catch (e) {
    return { ok: false, error: mensajeError(e) }
  }
}
