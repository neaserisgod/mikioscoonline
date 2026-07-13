"use server"

import { auth } from "@/auth"
import { cajaSesionService } from "@/services/cajaSesion.service"
import { z } from "zod"

async function requireAuth() {
  const session = await auth()
  if (!session?.user?.organizationId) throw new Error("No autorizado")
  return session.user as { id: string; organizationId: string; role: string }
}

const AbrirSchema = z.object({
  fondoInicialCentavos: z.number().int().min(0),
})

const CerrarSchema = z.object({
  efectivoContadoCentavos: z.number().int().min(0),
  nota: z.string().optional(),
})

const MovimientoSchema = z.object({
  tipo: z.enum(["INGRESO", "EGRESO"]),
  montoCentavos: z.number().int().min(1, "El monto debe ser mayor a 0"),
  medioPagoId: z.string().optional(),
  nota: z.string().optional(),
})

export async function abrirCajaAction(cajaId: string, input: unknown) {
  const user = await requireAuth()
  const data = AbrirSchema.parse(input)
  return cajaSesionService.abrirCaja(user.organizationId, cajaId, user.id, data.fondoInicialCentavos)
}

export async function cerrarCajaAction(cajaSesionId: string, input: unknown) {
  const user = await requireAuth()
  const data = CerrarSchema.parse(input)
  return cajaSesionService.cerrarCaja(cajaSesionId, user.organizationId, user.id, data.efectivoContadoCentavos, data.nota)
}

export async function registrarMovimientoAction(cajaSesionId: string, input: unknown) {
  const user = await requireAuth()
  const data = MovimientoSchema.parse(input)
  return cajaSesionService.registrarMovimiento(cajaSesionId, user.organizationId, data)
}

const ArqueoParcialSchema = z.object({
  efectivoContadoCentavos: z.number().int().min(0),
  nota: z.string().optional(),
})

export async function registrarArqueoParcialAction(cajaSesionId: string, input: unknown) {
  const user = await requireAuth()
  const data = ArqueoParcialSchema.parse(input)
  return cajaSesionService.registrarArqueoParcial(
    cajaSesionId, user.organizationId, user.id, data.efectivoContadoCentavos, data.nota
  )
}
