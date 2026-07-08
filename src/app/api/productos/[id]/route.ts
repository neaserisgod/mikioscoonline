import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z, ZodError } from "zod"
import { requireAdminApi } from "@/lib/api-auth"
import { productoService } from "@/services/producto.service"

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error

  const { id } = await ctx.params
  const producto = await productoService.obtener(id, result.user.organizationId)
  if (!producto) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json(producto)
}

function mensajeError(e: unknown): string {
  if (e instanceof ZodError) return e.issues.map((i) => i.message).join(" · ")
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return "Ya existe un producto con ese SKU o código de barras"
    return "No se pudo guardar el producto (error de base de datos)"
  }
  if (e instanceof Error) return e.message
  return "No se pudo guardar el producto"
}

const EditarProductoSchema = z.object({
  sku: z.string().min(1).optional(),
  barcode: z.string().optional(),
  nombre: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  providerId: z.string().min(1).optional(),
  locationId: z.string().min(1).optional(),
  stock: z.number().int().min(0).optional(),
  stockMinimo: z.number().int().min(0).optional(),
  costoCentavos: z.number().int().positive().optional(),
  precioCentavos: z.number().int().positive().optional(),
  markupBp: z.number().int().optional(),
  esPesable: z.boolean().optional(),
  costoPorKgCentavos: z.number().int().positive().optional(),
  precioPorKgCentavos: z.number().int().positive().optional(),
  stockGramos: z.number().int().min(0).optional(),
  stockMinimoGramos: z.number().int().min(0).optional(),
  activo: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error

  const { id } = await ctx.params
  try {
    const body = await req.json()
    const { activo, ...resto } = EditarProductoSchema.parse(body)

    // "desactivar" es simplemente activo:false — mismo endpoint, no uno dedicado.
    if (activo === false && Object.keys(resto).length === 0) {
      await productoService.desactivar(id, result.user.organizationId)
      return NextResponse.json({ ok: true })
    }

    await productoService.editar({ id, organizationId: result.user.organizationId, ...resto })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: mensajeError(e) }, { status: 400 })
  }
}
