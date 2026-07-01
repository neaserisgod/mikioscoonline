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
