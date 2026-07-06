/**
 * VENDEDOR necesita el catálogo para vender (buscar/escanear productos), pero
 * no debe ver costo ni margen — solo ADMIN. Se aplica en la capa de API, no en
 * el servicio, para que el servicio siga siendo agnóstico de rol.
 */
export function sanitizarProducto<T extends { costoCentavos: number; costoPorKgCentavos?: number | null; costoEsProvisional: boolean }>(
  producto: T,
  role: "ADMIN" | "VENDEDOR"
): T {
  if (role === "ADMIN") return producto
  return { ...producto, costoCentavos: 0, costoPorKgCentavos: null, costoEsProvisional: false }
}

export function sanitizarProductos<T extends { costoCentavos: number; costoPorKgCentavos?: number | null; costoEsProvisional: boolean }>(
  productos: T[],
  role: "ADMIN" | "VENDEDOR"
): T[] {
  if (role === "ADMIN") return productos
  return productos.map((p) => sanitizarProducto(p, role))
}
