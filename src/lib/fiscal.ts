/**
 * Lógica fiscal argentina: cálculo de IVA, tipos de comprobante y numeración.
 *
 * Convención de precios:
 *   - precioCentavos del producto = precio BRUTO (con IVA incluido).
 *   - El sistema back-calcula neto e IVA según el tipo de comprobante.
 *   - Factura A: IVA discriminado (se muestra neto + IVA).
 *   - Factura B/C: IVA no discriminado (precio final = total).
 *   - En ambos casos los montos internos (neto, iva, subtotal) se guardan en centavos.
 */

export type CondicionIVA =
  | "RESPONSABLE_INSCRIPTO"
  | "MONOTRIBUTO"
  | "CONSUMIDOR_FINAL"
  | "EXENTO"

export type TipoComprobante =
  | "FACTURA_A"
  | "FACTURA_B"
  | "FACTURA_C"
  | "NOTA_CREDITO_A"
  | "NOTA_CREDITO_B"
  | "NOTA_CREDITO_C"
  | "PRESUPUESTO"

export interface ItemCalculo {
  netoCentavos: number
  ivaCentavos: number
  subtotalCentavos: number
}

export interface TotalesVenta {
  subtotalCentavos: number  // suma de netos
  ivaTotalCentavos: number
  totalCentavos: number
}

/**
 * Determina el tipo de comprobante en base a las condiciones IVA
 * del emisor (organización) y el cliente.
 */
export function determinarTipoComprobante(
  emisorCondicion: CondicionIVA,
  clienteCondicion: CondicionIVA
): TipoComprobante {
  if (emisorCondicion === "MONOTRIBUTO") return "FACTURA_C"
  if (emisorCondicion === "EXENTO") return "FACTURA_B"
  // Emisor Responsable Inscripto:
  if (clienteCondicion === "RESPONSABLE_INSCRIPTO") return "FACTURA_A"
  return "FACTURA_B"
}

/**
 * Calcula neto, IVA y subtotal de un ítem de venta.
 * El precio que ingresa es BRUTO (incluye IVA).
 * El cálculo es idéntico para A/B/C: el precio ya tiene IVA.
 */
export function calcularItemVenta(
  precioUnitarioCentavos: number,
  cantidad: number,
  alicuotaIVA: number  // 0, 10.5 o 21
): ItemCalculo {
  const subtotalCentavos = precioUnitarioCentavos * cantidad
  const factor = 1 + alicuotaIVA / 100
  const netoCentavos = Math.round(subtotalCentavos / factor)
  const ivaCentavos = subtotalCentavos - netoCentavos

  return { netoCentavos, ivaCentavos, subtotalCentavos }
}

/** Suma los totales de una lista de ítems calculados. */
export function calcularTotalesVenta(
  items: ItemCalculo[]
): TotalesVenta {
  const subtotalCentavos = items.reduce((s, i) => s + i.netoCentavos, 0)
  const ivaTotalCentavos = items.reduce((s, i) => s + i.ivaCentavos, 0)
  const totalCentavos = items.reduce((s, i) => s + i.subtotalCentavos, 0)
  return { subtotalCentavos, ivaTotalCentavos, totalCentavos }
}

/** Las alícuotas de IVA válidas en Argentina. */
export const ALICUOTAS_IVA = [0, 10.5, 21] as const
export type AlicuotaIVA = (typeof ALICUOTAS_IVA)[number]

/** Código AFIP para la alícuota. */
export function codigoAfipAlicuota(alicuota: number): number {
  const map: Record<number, number> = { 0: 3, 10.5: 4, 21: 5 }
  return map[alicuota] ?? 5
}
