/**
 * VENDEDOR necesita el catálogo para vender (buscar/escanear productos), pero
 * no debe ver costo ni margen — solo ADMIN. Se aplica en la capa de API, no en
 * el servicio, para que el servicio siga siendo agnóstico de rol.
 */
type ConVariantes = { variantes?: Array<{ costoCentavos: number }> }

export function sanitizarProducto<
  T extends { costoCentavos: number; costoPorKgCentavos?: number | null; costoEsProvisional: boolean } & ConVariantes,
>(producto: T, role: "ADMIN" | "VENDEDOR"): T {
  if (role === "ADMIN") return producto
  return {
    ...producto,
    costoCentavos: 0,
    costoPorKgCentavos: null,
    costoEsProvisional: false,
    // El dueño trae sus variantes embebidas (ver incluirRelaciones en
    // producto.service.ts) — cada una necesita el mismo ocultamiento de costo.
    ...(producto.variantes ? { variantes: producto.variantes.map((v) => ({ ...v, costoCentavos: 0 })) } : {}),
  }
}

export function sanitizarProductos<
  T extends { costoCentavos: number; costoPorKgCentavos?: number | null; costoEsProvisional: boolean } & ConVariantes,
>(productos: T[], role: "ADMIN" | "VENDEDOR"): T[] {
  if (role === "ADMIN") return productos
  return productos.map((p) => sanitizarProducto(p, role))
}

/** Mismo criterio que sanitizarProducto pero para los resúmenes agregados por
 * proveedor/categoría (gananciaPotencialCentavos, valorCostoCentavos, etc.) —
 * VENDEDOR necesita navegar el catálogo por proveedor/categoría, pero no ver
 * el dinero involucrado. */
export function sanitizarResumen<T extends { gananciaPotencialCentavos: number; valorCostoCentavos?: number; valorVentaCentavos?: number }>(
  filas: T[],
  role: "ADMIN" | "VENDEDOR"
): T[] {
  if (role === "ADMIN") return filas
  return filas.map((f) => ({
    ...f,
    gananciaPotencialCentavos: 0,
    ...("valorCostoCentavos" in f ? { valorCostoCentavos: 0 } : {}),
    ...("valorVentaCentavos" in f ? { valorVentaCentavos: 0 } : {}),
  }))
}
