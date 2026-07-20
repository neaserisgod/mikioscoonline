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
  sku: z.string().min(1).optional(),
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
  // Pesables (vendidos por peso) — ver domain/pesables.ts
  esPesable: z.boolean().optional(),
  costoPorKgCentavos: z.number().int().positive().optional(),
  precioPorKgCentavos: z.number().int().positive().optional(),
  stockGramos: z.number().int().min(0).optional(),
  stockMinimoGramos: z.number().int().min(0).optional(),
  // Variantes que comparten stock (Fase 2) — ver validarVariante en producto.service.ts
  variantOfId: z.string().min(1).nullable().optional(),
  unidadesPorVenta: z.number().int().min(1).optional(),
})

const CrearProductoSchema = ProductoBaseSchema.refine(
  (d) =>
    d.esPesable
      ? d.precioPorKgCentavos !== undefined || d.costoPorKgCentavos !== undefined
      : d.precioCentavos !== undefined || d.costoCentavos !== undefined,
  { message: "Se requiere al menos precio o costo (por kg si es pesable)" }
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
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return "Ya existe un producto con ese SKU o código de barras"
    // Cualquier otro código (P2003, P2025, etc.) — no devolver el mensaje nativo de
    // Prisma al cliente, filtra nombres de columnas/tablas internas.
    return "No se pudo guardar el producto (error de base de datos)"
  }
  if (e instanceof Error) return e.message
  return "No se pudo guardar el producto"
}

// ─── Actions ──────────────────────────────────────────────────────────────────

// VENDEDOR nunca debe fijar costo — aunque el form ya lo oculta, esto es la
// defensa real (el form es solo UX, no un límite de seguridad). Sin costo,
// producto.service.ts estima uno provisional a partir del markup default de
// la categoría (ver resolverTriangulo) — el ADMIN lo corrige después.
function sinCostoSiNoEsAdmin<T extends { costoCentavos?: number; costoPorKgCentavos?: number; markupBp?: number }>(
  data: T,
  role: "ADMIN" | "VENDEDOR"
): T {
  if (role === "ADMIN") return data
  return { ...data, costoCentavos: undefined, costoPorKgCentavos: undefined, markupBp: undefined }
}

// Mismo criterio que sinCostoSiNoEsAdmin: VENDEDOR nunca debe poder ajustar el
// stock actual desde "Editar producto" (eso es lo que exige el flujo dedicado
// de ajuste de stock, ver ajusteStockAction) — el form ya lo deshabilita para
// VENDEDOR, pero esto es la defensa real. stockMinimo/stockMinimoGramos no son
// la cantidad real (solo un umbral de alerta) así que se dejan pasar igual.
function sinStockSiNoEsAdmin<T extends { stock?: number; stockGramos?: number }>(
  data: T,
  role: "ADMIN" | "VENDEDOR"
): T {
  if (role === "ADMIN") return data
  return { ...data, stock: undefined, stockGramos: undefined }
}

export async function crearProductoAction(input: unknown): Promise<GuardarProductoResult> {
  try {
    const session = await auth()
    if (!session?.user?.organizationId) return { ok: false, error: "No autorizado" }

    const parsed = sinCostoSiNoEsAdmin(CrearProductoSchema.parse(input), session.user.role)
    await productoService.crear({ ...parsed, organizationId: session.user.organizationId })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: mensajeError(e) }
  }
}

export async function editarProductoAction(id: string, input: unknown): Promise<GuardarProductoResult> {
  try {
    const session = await auth()
    if (!session?.user?.organizationId || !session.user.id) return { ok: false, error: "No autorizado" }

    const sinCosto = sinCostoSiNoEsAdmin(EditarProductoSchema.parse(input), session.user.role)
    const parsed = sinStockSiNoEsAdmin(sinCosto, session.user.role)
    await productoService.editar({
      id,
      organizationId: session.user.organizationId,
      userId: session.user.id,
      ...parsed,
    })
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
