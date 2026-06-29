// Cálculo de comisiones por medio de pago.
// comisionBp en basis points: 399 = 3.99%

export interface ResultadoComision {
  comisionCentavos: number
  montoNetoCentavos: number
}

/**
 * Calcula la comisión estimada y el monto neto para un pago.
 * comisionBp: 0 para efectivo, 399 para MercadoPago (3.99%), etc.
 */
export function calcularComision(
  montoCentavos: number,
  comisionBp: number
): ResultadoComision {
  if (comisionBp < 0) throw new Error("comisionBp no puede ser negativo")
  const comisionCentavos = Math.round((montoCentavos * comisionBp) / 10_000)
  return {
    comisionCentavos,
    montoNetoCentavos: montoCentavos - comisionCentavos,
  }
}

/**
 * Suma las comisiones de múltiples pagos.
 */
export function totalComisiones(
  pagos: Array<{ comisionCentavos: number }>
): number {
  return pagos.reduce((sum, p) => sum + p.comisionCentavos, 0)
}
