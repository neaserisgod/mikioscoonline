// Productos pesables (vendidos por peso, ej. fiambre).
// Punto único de cálculo: evita que algún lugar multiplique precio-por-kg
// por cantidad-en-unidades (o viceversa) y corrompa un total en plata.

export interface DatosPrecioProducto {
  esPesable: boolean
  precioCentavos: number
  costoCentavos: number
  precioPorKgCentavos: number | null
  costoPorKgCentavos: number | null
}

/** Precio "efectivo" del producto según sea pesable o no — el que corresponde fotografiar en la línea de venta. */
export function precioUnitarioEfectivo(producto: DatosPrecioProducto): number {
  if (!producto.esPesable) return producto.precioCentavos
  if (producto.precioPorKgCentavos == null) {
    throw new Error("Producto pesable sin precioPorKgCentavos configurado")
  }
  return producto.precioPorKgCentavos
}

/** Costo "efectivo" del producto según sea pesable o no — el que corresponde fotografiar en la línea de venta. */
export function costoUnitarioEfectivo(producto: DatosPrecioProducto): number {
  if (!producto.esPesable) return producto.costoCentavos
  if (producto.costoPorKgCentavos == null) {
    throw new Error("Producto pesable sin costoPorKgCentavos configurado")
  }
  return producto.costoPorKgCentavos
}

/**
 * Subtotal de una línea de venta/reporte.
 * - No pesable: precioUnitarioCentavos × cantidad (unidades).
 * - Pesable: precioUnitarioCentavos (por kg) × gramos / 1000.
 */
export function subtotalLinea(input: {
  esPesable: boolean
  precioUnitarioCentavos: number
  cantidad: number
  gramos: number | null
}): number {
  if (input.esPesable) {
    return Math.round((input.precioUnitarioCentavos * (input.gramos ?? 0)) / 1000)
  }
  return input.precioUnitarioCentavos * input.cantidad
}

/** Stock disponible efectivo (gramos si es pesable, unidades si no). */
export function stockDisponible(producto: { esPesable: boolean; stock: number; stockGramos: number | null }): number {
  return producto.esPesable ? (producto.stockGramos ?? 0) : producto.stock
}

/** Valor del stock disponible de un producto, a precio de lista y a costo —
 * base compartida por `gananciaPotencial` (valorVenta - valorCosto) y por
 * el valor de mercadería a costo del negocio completo (ver
 * productoService.valorInventario). */
export function valoresInventario(
  producto: DatosPrecioProducto & { stock: number; stockGramos: number | null }
): { valorVentaCentavos: number; valorCostoCentavos: number } {
  const precioUnit = precioUnitarioEfectivo(producto)
  const costoUnit = costoUnitarioEfectivo(producto)
  const cantidad = stockDisponible(producto)
  const gramos = producto.esPesable ? cantidad : null
  const valorVentaCentavos = subtotalLinea({ esPesable: producto.esPesable, precioUnitarioCentavos: precioUnit, cantidad, gramos })
  const valorCostoCentavos = subtotalLinea({ esPesable: producto.esPesable, precioUnitarioCentavos: costoUnit, cantidad, gramos })
  return { valorVentaCentavos, valorCostoCentavos }
}

/** Ganancia potencial si se vendiera todo el stock actual al precio de lista
 * (precio − costo, multiplicado por el stock disponible). No es rentabilidad
 * real (esa se calcula sobre ventas ya hechas, ver rentabilidad.service.ts) —
 * es una proyección sobre el inventario que hay ahora. */
export function gananciaPotencial(producto: DatosPrecioProducto & { stock: number; stockGramos: number | null }): number {
  const { valorVentaCentavos, valorCostoCentavos } = valoresInventario(producto)
  return valorVentaCentavos - valorCostoCentavos
}
