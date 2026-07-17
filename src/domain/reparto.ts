// Cascada de reparto del efectivo disponible — ver docs/MODELO-FINANCIERO.md
// ("¿Cuánta plata libre tengo hoy?"). Todos los montos en centavos.

export interface InputReparto {
  /** Efectivo/saldo real disponible ahora mismo (todas las cajas relevantes). */
  disponibleRealCentavos: number
  /** Piso de reinversión sumado de todos los proveedores (Provider.pisoReposicionCentavos). */
  reservaReposicionCentavos: number
  /** Suma de Provider.saldoCuentaCorrienteCentavos > 0 (deuda real; los saldos
   * negativos son informativos — se pagó de más — y no restan acá). */
  deudaProveedoresCentavos: number
  /** Gastos fijos del mes ya netos de lo pagado (mismo cálculo que resumenService.mes). */
  gastosFijosPendientesCentavos: number
  /** Organization.monotributoCentavos — se resta completo. */
  monotributoCentavos: number
  /** Organization.sueldoObjetivoCentavos — se resta completo (sin seguimiento
   * de "ya retirado", ver el comentario en resumenService.reparto). */
  sueldoObjetivoCentavos: number
}

export interface ResultadoReparto {
  disponibleRealCentavos: number
  reservaReposicionCentavos: number
  reposicionCubierta: boolean
  reposicionFaltanteCentavos: number
  deudaProveedoresCentavos: number
  gastosFijosPendientesCentavos: number
  gastosFijosCubiertos: boolean
  gastosFijosFaltanteCentavos: number
  monotributoCentavos: number
  sueldoObjetivoCentavos: number
  /** Lo que queda después de TODA la cascada — plata libre real. */
  gananciaDisponibleCentavos: number
}

/**
 * Orden de prioridad (cada paso solo puede gastar lo que dejó el anterior):
 *   1. Reposición de stock (piso por proveedor) — no es ganancia, es capital que gira.
 *   2. Deuda a proveedores por pagar (cuenta corriente).
 *   3. Gastos fijos pendientes del mes.
 *   4. Monotributo del mes.
 *   5. Sueldo objetivo (siempre completo, ver arriba).
 * Lo que sobra después de los 5 pasos es la ganancia real libre — recién ahí
 * es "plata propia" para reponer más, crecer, equipar o retirar de más.
 */
export function calcularReparto(input: InputReparto): ResultadoReparto {
  const {
    disponibleRealCentavos,
    reservaReposicionCentavos,
    deudaProveedoresCentavos,
    gastosFijosPendientesCentavos,
    monotributoCentavos,
    sueldoObjetivoCentavos,
  } = input

  const reposicionCubierta = disponibleRealCentavos >= reservaReposicionCentavos
  const reposicionFaltanteCentavos = Math.max(0, reservaReposicionCentavos - disponibleRealCentavos)
  const trasReposicionCentavos = Math.max(0, disponibleRealCentavos - reservaReposicionCentavos)

  const trasDeudaCentavos = Math.max(0, trasReposicionCentavos - deudaProveedoresCentavos)

  const gastosFijosCubiertos = trasDeudaCentavos >= gastosFijosPendientesCentavos
  const gastosFijosFaltanteCentavos = Math.max(0, gastosFijosPendientesCentavos - trasDeudaCentavos)
  const trasGastosCentavos = Math.max(0, trasDeudaCentavos - gastosFijosPendientesCentavos)

  const trasMonotributoCentavos = Math.max(0, trasGastosCentavos - monotributoCentavos)

  const gananciaDisponibleCentavos = Math.max(0, trasMonotributoCentavos - sueldoObjetivoCentavos)

  return {
    disponibleRealCentavos,
    reservaReposicionCentavos,
    reposicionCubierta,
    reposicionFaltanteCentavos,
    deudaProveedoresCentavos,
    gastosFijosPendientesCentavos,
    gastosFijosCubiertos,
    gastosFijosFaltanteCentavos,
    monotributoCentavos,
    sueldoObjetivoCentavos,
    gananciaDisponibleCentavos,
  }
}
