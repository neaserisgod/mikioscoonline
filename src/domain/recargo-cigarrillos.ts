// Recargo por pagar cigarrillos con QR/Posnet: el proveedor de cigarrillos
// solo acepta efectivo, así que el negocio traslada como recargo el costo de
// conseguir ese efectivo (ver traspaso de cigarrillos en venta.service.ts).
// Solo aplica a productos de la categoría Cigarrillos, nunca al resto del
// carrito, y es escalonado por cantidad — no un % ni un fijo por medio de pago.
const RECARGO_PRIMER_ATADO_CENTAVOS = 30_000
const RECARGO_ATADO_ADICIONAL_CENTAVOS = 10_000
const RECARGO_CIGARRO_SUELTO_CENTAVOS = 5_000

export interface ItemCigarrillo {
  esCigarrillo: boolean
  esCigarroSuelto: boolean
  cantidad: number
}

/**
 * Recargo total de una venta (o de la porción de una venta) por sus unidades
 * de cigarrillos: el primer atado cuesta más que los siguientes (sin importar
 * la marca — se cuenta el total de atados de la venta), y los cigarros
 * sueltos tienen su propio monto fijo por unidad.
 */
export function calcularRecargoCigarrillos(items: ItemCigarrillo[]): number {
  let atados = 0
  let sueltos = 0
  for (const item of items) {
    if (!item.esCigarrillo) continue
    if (item.esCigarroSuelto) sueltos += item.cantidad
    else atados += item.cantidad
  }

  const recargoAtados =
    atados > 0 ? RECARGO_PRIMER_ATADO_CENTAVOS + (atados - 1) * RECARGO_ATADO_ADICIONAL_CENTAVOS : 0
  const recargoSueltos = sueltos * RECARGO_CIGARRO_SUELTO_CENTAVOS

  return recargoAtados + recargoSueltos
}
