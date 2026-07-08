import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z, ZodError } from "zod"
import { requireSessionApi, requireAdminApi } from "@/lib/api-auth"
import { productoService } from "@/services/producto.service"
import { sanitizarProductos } from "@/lib/sanitizar-producto"

export async function GET(req: NextRequest) {
  const result = await requireSessionApi()
  if ("error" in result) return result.error
  const { organizationId, role } = result.user

  const { searchParams } = req.nextUrl
  const q = searchParams.get("q")
  const stockBajo = searchParams.get("stockBajo") === "1"
  const since = searchParams.get("since")

  if (stockBajo) {
    const data = await productoService.stockBajo(organizationId)
    return NextResponse.json(data)
  }

  if (since) {
    const desde = new Date(since)
    if (Number.isNaN(desde.getTime())) {
      return NextResponse.json({ error: "Parámetro 'since' inválido" }, { status: 400 })
    }
    const data = await productoService.listarDesde(organizationId, desde)
    return NextResponse.json(sanitizarProductos(data, role))
  }

  const data = q
    ? await productoService.buscar(organizationId, q)
    : await productoService.listar(organizationId)

  return NextResponse.json(sanitizarProductos(data, role))
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

const ProductoBaseSchema = z.object({
  sku: z.string().min(1).optional(),
  barcode: z.string().optional(),
  nombre: z.string().min(1),
  categoryId: z.string().min(1, "Elegí una categoría"),
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
})

const CrearProductoSchema = ProductoBaseSchema.refine(
  (d) =>
    d.esPesable
      ? d.precioPorKgCentavos !== undefined || d.costoPorKgCentavos !== undefined
      : d.precioCentavos !== undefined || d.costoCentavos !== undefined,
  { message: "Se requiere al menos precio o costo (por kg si es pesable)" }
)

export async function POST(req: NextRequest) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error

  try {
    const body = await req.json()
    const parsed = CrearProductoSchema.parse(body)
    await productoService.crear({ ...parsed, organizationId: result.user.organizationId })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: mensajeError(e) }, { status: 400 })
  }
}
