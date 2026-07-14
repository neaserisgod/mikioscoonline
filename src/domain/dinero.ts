// Helpers de dinero. Todos los montos internos son centavos (Int).

/** Formatea centavos como string ARS: 150050 → "$1.500,50" */
export function formatearARS(centavos: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(centavos / 100)
}

/** Formatea centavos sin símbolo: 150050 → "1.500,50" */
export function formatearMonto(centavos: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centavos / 100)
}

/**
 * Parsea un string ARS a centavos.
 * Acepta "1.500,50", "1500.50", "$1.500,50", "1500".
 */
export function parsearARS(valor: string): number {
  const limpio = valor
    .replace(/\$/g, "")
    .trim()
    // Si tiene coma como separador decimal (formato argentino)
    .replace(/\.(\d{3})/g, "$1") // quitar puntos de miles
    .replace(",", ".")            // coma decimal → punto
  const num = parseFloat(limpio)
  if (isNaN(num)) throw new Error(`Monto inválido: "${valor}"`)
  return Math.round(num * 100)
}

/** Convierte centavos a número flotante (solo para display/exportación, nunca para cálculos). */
export function centavosAFloat(centavos: number): number {
  return centavos / 100
}

/** Convierte un número flotante a centavos redondeando (solo para ingreso de datos). */
export function floatACentavos(valor: number): number {
  return Math.round(valor * 100)
}

/** Redondea centavos hacia arriba al peso entero: 150001 → 150100 ($1500.01 → $1501).
 * El negocio no maneja centavos — precio, costo y el total del ticket siempre
 * se redondean para arriba, nunca para el cliente pagar de menos. */
export function redondearPesoArriba(centavos: number): number {
  return Math.ceil(centavos / 100) * 100
}

/** Devuelve "YYYY-MM" del mes actual para uso en FixedExpenseMonto. */
export function mesAnioActual(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

/** Genera string "YYYY-MM" de un Date. */
export function toMesAnio(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/** Inicio del día (00:00:00.000 UTC local). */
export function inicioDia(date: Date = new Date()): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Fin del día (23:59:59.999 UTC local). */
export function finDia(date: Date = new Date()): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/** Inicio del mes. */
export function inicioMes(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
}

/** Fin del mes. */
export function finMes(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

/**
 * Parsea una fecha de query param ("YYYY-MM-DD"). `undefined` = el param no vino
 * (usar el default del caller); `null` = vino pero es un string inválido (el
 * caller debe responder 400, no dejar que un Invalid Date llegue a Prisma).
 *
 * Un "YYYY-MM-DD" se arma a mano en horario LOCAL — `new Date("YYYY-MM-DD")`
 * lo interpreta como medianoche UTC, que en husos horarios negativos (ej.
 * Argentina, UTC-3) cae a las 21:00 del día anterior en hora local, corriendo
 * todo el rango un día para atrás (y hasta de mes, en casos límite). Callers
 * que arman un rango [desde, hasta] todavía necesitan pasar el `hasta` por
 * `finDia()` — esta función sola solo da el inicio del día indicado.
 */
export function parseFechaQuery(valor: string | null): Date | undefined | null {
  if (valor == null) return undefined
  const soloDia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  if (soloDia) {
    const fecha = new Date(Number(soloDia[1]), Number(soloDia[2]) - 1, Number(soloDia[3]), 0, 0, 0, 0)
    return isNaN(fecha.getTime()) ? null : fecha
  }
  const fecha = new Date(valor)
  return isNaN(fecha.getTime()) ? null : fecha
}
