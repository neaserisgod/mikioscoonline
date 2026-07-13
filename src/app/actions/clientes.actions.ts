"use server"

import { auth } from "@/auth"
import { customerService } from "@/services/customer.service"
import { z } from "zod"

async function requireAuth() {
  const session = await auth()
  if (!session?.user?.organizationId) throw new Error("No autorizado")
  return session.user as { id: string; organizationId: string; role: string }
}

const ClienteSchema = z.object({
  nombre: z.string().min(1),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
})

export async function crearClienteAction(input: unknown) {
  const user = await requireAuth()
  return customerService.crear(user.organizationId, ClienteSchema.parse(input))
}

export async function editarClienteAction(id: string, input: unknown) {
  const user = await requireAuth()
  return customerService.editar(id, user.organizationId, ClienteSchema.parse(input))
}

export async function desactivarClienteAction(id: string) {
  const user = await requireAuth()
  return customerService.desactivar(id, user.organizationId)
}

export async function reactivarClienteAction(id: string) {
  const user = await requireAuth()
  return customerService.reactivar(id, user.organizationId)
}

export async function registrarPagoDeudaClienteAction(id: string, montoCentavos: unknown, cajaId: unknown) {
  const user = await requireAuth()
  const monto = z.number().int().positive().parse(montoCentavos)
  const caja = z.string().min(1).parse(cajaId)
  return customerService.registrarPagoDeuda(id, user.organizationId, monto, caja)
}

export async function registrarDeudaManualClienteAction(id: string, montoCentavos: unknown) {
  const user = await requireAuth()
  const monto = z.number().int().positive().parse(montoCentavos)
  return customerService.registrarDeudaManual(id, user.organizationId, monto)
}
