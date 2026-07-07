// Punto de equilibrio y ganancia neta mensual.
// Todos los montos en centavos.

export interface InputEquilibrio {
  /** Suma de todos los gastos fijos activos del mes */
  gastosFijosCentavos: number
  /** Suma de (precioUnitario - costoUnitario) × cantidad de todas las ventas del mes */
  gananciaBrutaCentavos: number
  /** Suma de comisionCentavos de todos los pagos del mes */
  comisionesTotalesCentavos: number
}

export interface ResultadoEquilibrio {
  gastosFijosCentavos: number
  gananciaBrutaCentavos: number
  comisionesTotalesCentavos: number
  /** Ganancia neta = ganancia bruta − comisiones − gastos fijos */
  gananciaNetaCentavos: number
  /** 0-100: % de gastos fijos cubiertos por ganancia bruta neta de comisiones */
  pctAvance: number
  /** Cuánto falta para cubrir gastos fijos. 0 si ya se cubrió. */
  faltanteCentavos: number
  cubierto: boolean
}

export function calcularEquilibrio(input: InputEquilibrio): ResultadoEquilibrio {
  const { gastosFijosCentavos, gananciaBrutaCentavos, comisionesTotalesCentavos } = input

  const gananciaNetaCentavos =
    gananciaBrutaCentavos - comisionesTotalesCentavos - gastosFijosCentavos

  const gananciaDisponible = gananciaBrutaCentavos - comisionesTotalesCentavos

  const pctAvance =
    gastosFijosCentavos === 0
      ? (gananciaDisponible >= 0 ? 100 : 0)
      : Math.max(0, Math.min(100, Math.round((gananciaDisponible / gastosFijosCentavos) * 100)))

  const faltanteCentavos = Math.max(0, gastosFijosCentavos - gananciaDisponible)

  return {
    gastosFijosCentavos,
    gananciaBrutaCentavos,
    comisionesTotalesCentavos,
    gananciaNetaCentavos,
    pctAvance,
    faltanteCentavos,
    cubierto: faltanteCentavos === 0,
  }
}
