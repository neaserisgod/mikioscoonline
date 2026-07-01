"use server"

import { auth } from "@/auth"
import { productoService } from "@/services/producto.service"
import { Prisma } from "@prisma/client"
import { z, ZodError } from "zod"

// ─── Schemas Zod ─────────────────────────────────────────────────────────────

// Base SIN refinement. Zod 4 lanza al evaluar el módulo si se hace .partial()
// sobre un schema que ya tiene .refine(), así que el refinement se aplica recién
// al derivar CrearProductoSchema, y Editar parte de esta base limpia.
const ProductoBaseSchema = z.object({
  sku: z.string().min(1),
  barcode: z.string().optional(),
  nombre: z.string().min(1),
  categoryId: z.string().min(1, "Elegí una categoría"),
  providerId: z.string().min(1).optional(),
  locationId: z.string().min(1).optional(),
  stock: z.number().int().min(0).optional(),
  stockMinimo: z.number().int().min(0).optional(),
  // Triángulo: al menos 1 de los 3
  costoCentavos: z.number().int().positive().optional(),
  precioCentavos: z.number().int().positive().optional(),
  markupBp: z.number().int().optional(),
})

const CrearProductoSchema = ProductoBaseSchema.refine(
  (d) => d.precioCentavos !== undefined || d.costoCentavos !== undefined,
  { message: "Se requiere al menos precio o costo" }
)

const EditarProductoSchema = ProductoBaseSchema.omit({ sku: true }).partial()

const ActualizarCostoSchema = z.object({
  id: z.string().min(1),
  costoCentavos: z.number().int().positive(),
})

// ─── Resultado de acciones de guardado ────────────────────────────────────────
// Devolvemos el error como dato (no lo lanzamos) para que el mensaje real llegue
// al cliente. Next.js enmascara los errores LANZADOS en producción ("digest"),
// pero los valores devueltos pasan tal cual.

type GuardarProductoResult = { ok: true } | { ok: false; error: string }

function mensajeError(e: unknown): string {
  if (e instanceof ZodError) {
    return e.issues.map((i) => i.message).join(" · ")
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    return "Ya existe un producto con ese SKU o código de barras"
  }
  if (e instanceof Error) return e.message
  return "No se pudo guardar el producto"
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function crearProductoAction(input: unknown): Promise<GuardarProductoResult> {
  try {
    const session = await auth()
    if (!session?.user?.organizationId) return { ok: false, error: "No autorizado" }
    if (session.user.role !== "ADMIN") return { ok: false, error: "Solo ADMIN puede crear productos" }

    const parsed = CrearProductoSchema.parse(input)
    await productoService.crear({ ...parsed, organizationId: session.user.organizationId })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: mensajeError(e) }
  }
}

export async function editarProductoAction(id: string, input: unknown): Promise<GuardarProductoResult> {
  try {
    const session = await auth()
    if (!session?.user?.organizationId) return { ok: false, error: "No autorizado" }
    if (session.user.role !== "ADMIN") return { ok: false, error: "Solo ADMIN puede editar productos" }

    const parsed = EditarProductoSchema.parse(input)
    await productoService.editar({ id, organizationId: session.user.organizationId, ...parsed })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: mensajeError(e) }
  }
}

export async function actualizarCostoAction(input: unknown): Promise<GuardarProductoResult> {
  try {
    const session = await auth()
    if (!session?.user?.organizationId) return { ok: false, error: "No autorizado" }
    if (session.user.role !== "ADMIN") return { ok: false, error: "Solo ADMIN puede actualizar costos" }

    const { id, costoCentavos } = ActualizarCostoSchema.parse(input)
    await productoService.actualizarCosto(id, session.user.organizationId, costoCentavos)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: mensajeError(e) }
  }
}

export async function desactivarProductoAction(id: string): Promise<GuardarProductoResult> {
  try {
    const session = await auth()
    if (!session?.user?.organizationId) return { ok: false, error: "No autorizado" }
    if (session.user.role !== "ADMIN") return { ok: false, error: "Solo ADMIN puede desactivar productos" }

    await productoService.desactivar(id, session.user.organizationId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: mensajeError(e) }
  }
}

export async function importarProductosCSVAction(csv: string) {
  const session = await auth()
  if (!session?.user?.organizationId) throw new Error("No autorizado")
  if (session.user.role !== "ADMIN") throw new Error("Solo ADMIN puede importar productos")

  return productoService.importarCSV(csv, session.user.organizationId)
}
