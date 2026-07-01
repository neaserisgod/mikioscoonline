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

export interface RecargoConfig {
  recargoTipo: string
  recargoVirtualBp: number
  recargoVirtualFijoCentavos: number
}

/**
 * Recargo virtual que un medio de pago no-efectivo aplica sobre un monto.
 * Se configura una vez por medio de pago (no por caja) — ver PaymentMethod.
 */
export function calcularRecargo(medio: RecargoConfig, montoCentavos: number): number {
  return medio.recargoTipo === "PORCENTUAL"
    ? Math.round((montoCentavos * medio.recargoVirtualBp) / 10_000)
    : medio.recargoVirtualFijoCentavos
}
