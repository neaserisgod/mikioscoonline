"use server"

import { auth } from "@/auth"
import { cajaService } from "@/services/caja.service"
import { z } from "zod"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.organizationId) throw new Error("No autorizado")
  if (session.user.role !== "ADMIN") throw new Error("Solo ADMIN puede modificar cajas")
  return session.user as { id: string; organizationId: string; role: string }
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CajaSchema = z.object({
  nombre: z.string().min(1, "Requerido"),
})

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function crearCajaAction(input: unknown) {
  const user = await requireAdmin()
  const data = CajaSchema.parse(input)
  return cajaService.crear(user.organizationId, data)
}

export async function editarCajaAction(id: string, input: unknown) {
  const user = await requireAdmin()
  const data = CajaSchema.partial().parse(input)
  return cajaService.editar(id, user.organizationId, data)
}

export async function desactivarCajaAction(id: string) {
  const user = await requireAdmin()
  return cajaService.desactivar(id, user.organizationId)
}

export async function reactivarCajaAction(id: string) {
  const user = await requireAdmin()
  return cajaService.reactivar(id, user.organizationId)
}

export async function asignarCategoriasCajaAction(cajaId: string, categoriaIds: string[]) {
  const user = await requireAdmin()
  return cajaService.asignarCategorias(cajaId, user.organizationId, categoriaIds)
}
