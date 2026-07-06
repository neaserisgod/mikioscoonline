import type { EstadoPago } from "@prisma/client"

export const TRIAL_DIAS = 14
export const PRECIO_MENSUAL_CENTAVOS = 14_900_00

export function calcularTrialTerminaEl(desde: Date = new Date()): Date {
  const fin = new Date(desde)
  fin.setDate(fin.getDate() + TRIAL_DIAS)
  return fin
}

/** true = sin acceso al dashboard, hay que mandarlo a /suscripcion. */
export function accesoBloqueado(org: { estadoPago: EstadoPago; trialTerminaEl: Date | null }): boolean {
  if (org.estadoPago === "ACTIVO") return false
  if (org.estadoPago === "TRIAL") return org.trialTerminaEl != null && org.trialTerminaEl.getTime() <= Date.now()
  return true // VENCIDO | CANCELADO
}
