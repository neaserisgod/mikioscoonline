// Efectivo/total esperado de una sesión de caja a partir de sus movimientos.
// Todos los montos en centavos. Lógica pura — sin Prisma ni Next — para que la
// pueda consumir tanto el server (cajaSesion.service.ts, al cerrar caja o
// registrar un arqueo parcial) como el cliente (panel de Inicio, para
// previsualizar antes de esos mismos submits). Antes esta fórmula vivía
// duplicada en los dos lados y un bug (el recargo de QR/Posnet no sumaba al
// esperado) hubo que parchearlo en ambos por separado — fuente única acá para
// cerrar esa clase de bug.

export interface MovimientoParaTotales {
  tipo: string
  montoCentavos: number
  recargoCentavos: number
  medioPago: { esEfectivo: boolean } | null
}

export interface TotalesCaja {
  ventasEfectivo: number
  ventasDigital: number
  /** Recargo de QR/Posnet (ej. cigarrillos) — solo el de los movimientos que
   * efectivamente cuentan hacia `total` (ver `cajaManejaEfectivo`). */
  recargo: number
  ingresos: number
  egresos: number
  nVentas: number
  /** fondoInicial + ventas que cuentan + su recargo + ingresos − egresos. */
  total: number
}

/**
 * `cajaManejaEfectivo` decide qué ventas cuentan hacia `total`:
 * - Caja física (true): solo lo pagado en efectivo — es lo único que se puede
 *   contar en billetes al cerrar. Una venta con QR/Posnet que cayó acá por
 *   atribución de categoría no puso plata física en la caja (ni su recargo).
 * - Caja digital (false, ej. MercadoPago): TODA venta atribuida cuenta, sin
 *   filtrar por medio — acá no hay nada que contar en billetes, así que
 *   filtrar por esEfectivo (que para MP siempre es false) dejaría el total
 *   pegado al fondo inicial e ignoraría todas las ventas reales.
 *
 * El recargo de cada venta sigue la MISMA regla que su monto: llega junto con
 * el resto del pago a la misma cuenta de MercadoPago, no es una transacción
 * aparte — si la venta cuenta, su recargo también.
 *
 * `ventasEfectivo`/`ventasDigital`/`nVentas` en el resultado son el desglose
 * completo (sin filtrar por `cajaManejaEfectivo`), para paneles que quieren
 * mostrar ambos aunque `total` solo compute con uno.
 */
export function calcularTotalesCaja(
  movimientos: MovimientoParaTotales[],
  fondoInicialCentavos: number,
  cajaManejaEfectivo: boolean
): TotalesCaja {
  let ventasEfectivo = 0
  let ventasDigital = 0
  let recargo = 0
  let ingresos = 0
  let egresos = 0
  let nVentas = 0

  for (const m of movimientos) {
    if (m.tipo === "VENTA") {
      nVentas++
      const esEfectivo = !!m.medioPago?.esEfectivo
      if (esEfectivo) ventasEfectivo += m.montoCentavos
      else ventasDigital += m.montoCentavos
      if (!cajaManejaEfectivo || esEfectivo) recargo += m.recargoCentavos
    } else if (m.tipo === "INGRESO") {
      ingresos += m.montoCentavos
    } else if (m.tipo === "EGRESO") {
      egresos += m.montoCentavos
    }
  }

  const ventasQueCuentan = cajaManejaEfectivo ? ventasEfectivo : ventasEfectivo + ventasDigital
  const total = fondoInicialCentavos + ventasQueCuentan + recargo + ingresos - egresos

  return { ventasEfectivo, ventasDigital, recargo, ingresos, egresos, nVentas, total }
}
