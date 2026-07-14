// Triángulo costo-precio-markup.
// Todos los montos en centavos (Int). Porcentajes en basis points (bp).
// 7000 bp = 70.00%  |  500 bp = 5.00%
//
// Dos modos:
//   PORCENTUAL → precio = costo × (1 + bp/10000)
//   FIJO       → precio = costo + gananciaFijaCentavos
//
// El negocio no maneja centavos: todo precio/costo calculado se redondea para
// arriba al peso entero (ver domain/dinero.ts, redondearPesoArriba).

import { redondearPesoArriba } from "./dinero"

/**
 * precio = costo × (1 + markup)
 */
export function precioDesdeCosoYMarkup(costoCentavos: number, markupBp: number): number {
  return redondearPesoArriba(costoCentavos * (1 + markupBp / 10_000))
}

/**
 * costo = precio / (1 + markup)
 */
export function costoDesdeePrecioYMarkup(precioCentavos: number, markupBp: number): number {
  if (markupBp <= -10_000) throw new Error("markupBp no puede ser ≤ -10000 (división por cero)")
  return redondearPesoArriba(precioCentavos / (1 + markupBp / 10_000))
}

/**
 * markup = (precio − costo) / costo  →  basis points
 */
export function markupBpDesdeCostoYPrecio(costoCentavos: number, precioCentavos: number): number {
  if (costoCentavos === 0) throw new Error("costoCentavos no puede ser 0 para calcular markup")
  return Math.round(((precioCentavos - costoCentavos) / costoCentavos) * 10_000)
}

/** precio = costo + gananciaFija */
export function precioDesdeCosoYGananciaFija(costoCentavos: number, gananciaFijaCentavos: number): number {
  return redondearPesoArriba(costoCentavos + gananciaFijaCentavos)
}

/** costo = precio − gananciaFija */
export function costoDesdeePrecioYGananciaFija(precioCentavos: number, gananciaFijaCentavos: number): number {
  return redondearPesoArriba(precioCentavos - gananciaFijaCentavos)
}

/**
 * Ganancia bruta de una línea de venta.
 */
export function gananciaBruta(
  precioUnitarioCentavos: number,
  costoUnitarioCentavos: number,
  cantidad: number
): number {
  return (precioUnitarioCentavos - costoUnitarioCentavos) * cantidad
}

/**
 * Markup en bp de una línea de venta a partir de valores-foto.
 */
export function markupBpDeLinea(
  precioUnitarioCentavos: number,
  costoUnitarioCentavos: number
): number {
  return markupBpDesdeCostoYPrecio(costoUnitarioCentavos, precioUnitarioCentavos)
}

/** Convierte basis points a porcentaje display: 7000 → "70.00" */
export function bpAPorcentaje(bp: number): string {
  return (bp / 100).toFixed(2)
}

export interface ResultadoTriangulo {
  costoCentavos: number
  precioCentavos: number
  markupBp: number
  gananciaFijaCentavos: number
  costoEsProvisional: boolean
  margenNegativo: boolean
}

/**
 * Resuelve el triángulo dado 2 de los 3 valores, en modo PORCENTUAL o FIJO.
 *
 * Modo PORCENTUAL (default):
 *   precio = costo × (1 + bp/10000)
 *   Inputs: costoCentavos + markupBp | precioCentavos + markupBp | costoCentavos + precioCentavos
 *   Fallback (solo precio): estima costo con markupDefaultBp
 *
 * Modo FIJO:
 *   precio = costo + gananciaFijaCentavos
 *   Inputs: costoCentavos + gananciaFijaCentavos | precioCentavos + gananciaFijaCentavos | costoCentavos + precioCentavos
 *   Fallback (solo precio): estima costo con markupDefaultFijoCentavos
 *
 * Margen negativo está permitido: se devuelve el valor real y margenNegativo=true.
 */
export function resolverTriangulo(input: {
  costoCentavos?: number
  precioCentavos?: number
  // PORCENTUAL
  markupBp?: number
  // FIJO
  gananciaFijaCentavos?: number
  // defaults de la categoría
  markupDefaultBp: number
  markupDefaultTipo?: "PORCENTUAL" | "FIJO"
  markupDefaultFijoCentavos?: number
}): ResultadoTriangulo {
  const {
    costoCentavos,
    precioCentavos,
    markupBp,
    gananciaFijaCentavos,
    markupDefaultBp,
    markupDefaultTipo = "PORCENTUAL",
    markupDefaultFijoCentavos = 0,
  } = input

  const tieneCosto = costoCentavos !== undefined && costoCentavos > 0
  const tienePrecio = precioCentavos !== undefined && precioCentavos > 0
  const tieneMarkupPct = markupBp !== undefined
  const tieneGananciaFija = gananciaFijaCentavos !== undefined

  // ── PORCENTUAL ───────────────────────────────────────────────────────────────
  if (tieneMarkupPct) {
    if (tieneCosto) {
      const precio = precioDesdeCosoYMarkup(costoCentavos!, markupBp!)
      return make(costoCentavos!, precio, markupBp!, false)
    }
    if (tienePrecio) {
      const costo = costoDesdeePrecioYMarkup(precioCentavos!, markupBp!)
      return make(costo, precioCentavos!, markupBp!, false)
    }
  }

  // ── FIJO ─────────────────────────────────────────────────────────────────────
  if (tieneGananciaFija) {
    if (tieneCosto) {
      const precio = precioDesdeCosoYGananciaFija(costoCentavos!, gananciaFijaCentavos!)
      return make(costoCentavos!, precio, markupBpSafe(costoCentavos!, precio), false)
    }
    if (tienePrecio) {
      const costo = costoDesdeePrecioYGananciaFija(precioCentavos!, gananciaFijaCentavos!)
      return make(costo, precioCentavos!, markupBpSafe(costo, precioCentavos!), false)
    }
  }

  // ── Ambos extremos conocidos (costo + precio) — modo se deduce ───────────────
  if (tieneCosto && tienePrecio) {
    const mb = markupBpSafe(costoCentavos!, precioCentavos!)
    return make(costoCentavos!, precioCentavos!, mb, false)
  }

  // ── Solo precio → estima costo con el default de la categoría ─────────────────
  if (tienePrecio) {
    if (markupDefaultTipo === "FIJO") {
      const costo = costoDesdeePrecioYGananciaFija(precioCentavos!, markupDefaultFijoCentavos)
      return make(costo, precioCentavos!, markupBpSafe(costo, precioCentavos!), true)
    }
    // PORCENTUAL (default)
    const costo = costoDesdeePrecioYMarkup(precioCentavos!, markupDefaultBp)
    return make(costo, precioCentavos!, markupDefaultBp, true)
  }

  throw new Error(
    "Faltan datos: proveer al menos (precio), (costo + markup/ganancia) o (precio + costo)"
  )
}

// ─── Helpers internos ────────────────────────────────────────────────────────

/** markupBp sin tirar error cuando costo ≤ 0 (margen negativo permitido). */
function markupBpSafe(costoCentavos: number, precioCentavos: number): number {
  if (costoCentavos === 0) return 0
  return Math.round(((precioCentavos - costoCentavos) / costoCentavos) * 10_000)
}

function make(
  costoCentavos: number,
  precioCentavos: number,
  markupBp: number,
  costoEsProvisional: boolean,
): ResultadoTriangulo {
  return {
    costoCentavos,
    precioCentavos,
    markupBp,
    gananciaFijaCentavos: precioCentavos - costoCentavos,
    costoEsProvisional,
    margenNegativo: precioCentavos < costoCentavos,
  }
}
