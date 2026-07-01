/**
 * Resuelve la caja a la que pertenece una línea de venta.
 * Punto único de la lógica de fallback: si la categoría no tiene caja asignada,
 * usa la caja principal de la organización.
 */
export function resolverCajaId(
  categoryCajaId: string | null | undefined,
  cajaPrincipalId: string
): string {
  return categoryCajaId ?? cajaPrincipalId
}

export interface CajaRecargoConfig {
  recargoTipo: string
  recargoVirtualBp: number
  recargoVirtualFijoCentavos: number
}

/** Recargo virtual que una caja aplica sobre un monto pagado con medio no-efectivo. */
export function calcularRecargoCaja(caja: CajaRecargoConfig, montoCentavos: number): number {
  return caja.recargoTipo === "PORCENTUAL"
    ? Math.round((montoCentavos * caja.recargoVirtualBp) / 10_000)
    : caja.recargoVirtualFijoCentavos
}
