"use server"

import { auth } from "@/auth"
import { productoService } from "@/services/producto.service"
import { z } from "zod"

// ─── Schemas Zod ─────────────────────────────────────────────────────────────

const CrearProductoSchema = z
  .object({
    sku: z.string().min(1),
    barcode: z.string().optional(),
    nombre: z.string().min(1),
    categoryId: z.string().cuid(),
    providerId: z.string().cuid().optional(),
    locationId: z.string().cuid().optional(),
    stock: z.number().int().min(0).optional(),
    stockMinimo: z.number().int().min(0).optional(),
    // Triángulo: al menos 1 de los 3
    costoCentavos: z.number().int().positive().optional(),
    precioCentavos: z.number().int().positive().optional(),
    markupBp: z.number().int().optional(),
  })
  .refine(
    (d) => d.precioCentavos !== undefined || d.costoCentavos !== undefined,
    { message: "Se requiere al menos precio o costo" }
  )

const EditarProductoSchema = CrearProductoSchema.partial().omit({ sku: true })

const ActualizarCostoSchema = z.object({
  id: z.string().cuid(),
  costoCentavos: z.number().int().positive(),
})

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function crearProductoAction(input: unknown) {
  const session = await auth()
  if (!session?.user?.organizationId) throw new Error("No autorizado")
  if (session.user.role !== "ADMIN") throw new Error("Solo ADMIN puede crear productos")

  const parsed = CrearProductoSchema.parse(input)
  return productoService.crear({ ...parsed, organizationId: session.user.organizationId })
}

export async function editarProductoAction(id: string, input: unknown) {
  const session = await auth()
  if (!session?.user?.organizationId) throw new Error("No autorizado")
  if (session.user.role !== "ADMIN") throw new Error("Solo ADMIN puede editar productos")

  const parsed = EditarProductoSchema.parse(input)
  return productoService.editar({ id, organizationId: session.user.organizationId, ...parsed })
}

export async function actualizarCostoAction(input: unknown) {
  const session = await auth()
  if (!session?.user?.organizationId) throw new Error("No autorizado")
  if (session.user.role !== "ADMIN") throw new Error("Solo ADMIN puede actualizar costos")

  const { id, costoCentavos } = ActualizarCostoSchema.parse(input)
  return productoService.actualizarCosto(id, session.user.organizationId, costoCentavos)
}

export async function desactivarProductoAction(id: string) {
  const session = await auth()
  if (!session?.user?.organizationId) throw new Error("No autorizado")
  if (session.user.role !== "ADMIN") throw new Error("Solo ADMIN puede desactivar productos")

  return productoService.desactivar(id, session.user.organizationId)
}

export async function importarProductosCSVAction(csv: string) {
  const session = await auth()
  if (!session?.user?.organizationId) throw new Error("No autorizado")
  if (session.user.role !== "ADMIN") throw new Error("Solo ADMIN puede importar productos")

  return productoService.importarCSV(csv, session.user.organizationId)
}
