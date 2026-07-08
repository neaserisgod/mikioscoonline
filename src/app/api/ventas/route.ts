import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z, ZodError } from "zod"
import { requireSessionApi } from "@/lib/api-auth"
import { ventaService } from "@/services/venta.service"

const LineaSchema = z.object({
  productId: z.string().cuid(),
  cantidad: z.number().int().positive(),
  gramos: z.number().int().min(0).optional(),
})

const PagoSchema = z.object({
  paymentMethodId: z.string().cuid(),
  montoCentavos: z.number().int().positive(),
  referencia: z.string().optional(),
})

const CrearVentaSchema = z.object({
  lineas: z.array(LineaSchema).min(1, "La venta debe tener al menos una línea"),
  pagos: z.array(PagoSchema).min(1, "La venta debe tener al menos un pago"),
  descuentoCentavos: z.number().int().min(0).optional(),
})

function mensajeError(e: unknown): string {
  if (e instanceof ZodError) {
    return e.issues.map((i) => i.message).join(" · ")
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return "No se pudo registrar la venta (error de base de datos)"
  }
  if (e instanceof Error) return e.message
  return "No se pudo registrar la venta"
}

export async function POST(req: NextRequest) {
  const result = await requireSessionApi()
  if ("error" in result) return result.error

  try {
    const body = await req.json()
    const { lineas, pagos, descuentoCentavos } = CrearVentaSchema.parse(body)

    const venta = await ventaService.crear({
      userId: result.user.id,
      organizationId: result.user.organizationId,
      lineas,
      pagos,
      descuentoCentavos,
    })
    return NextResponse.json({ id: venta.id })
  } catch (e) {
    return NextResponse.json({ error: mensajeError(e) }, { status: 400 })
  }
}
