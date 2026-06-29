/** Convierte centavos a pesos ARS con formato "$1.234,56" */
export function formatARS(centavos: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(centavos / 100)
}

/** Centavos a número decimal legible */
export function centavosToDecimal(centavos: number): number {
  return centavos / 100
}

/** Decimal a centavos (redondeo correcto) */
export function decimalToCentavos(valor: number): number {
  return Math.round(valor * 100)
}

/** Formatea fecha a "dd/MM/yyyy" */
export function formatFecha(date: Date | string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date))
}

/** Formatea fecha con hora */
export function formatFechaHora(date: Date | string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

/** Etiqueta legible para condición de IVA */
export function labelCondicionIVA(condicion: string): string {
  const map: Record<string, string> = {
    RESPONSABLE_INSCRIPTO: "Responsable Inscripto",
    MONOTRIBUTO: "Monotributista",
    CONSUMIDOR_FINAL: "Consumidor Final",
    EXENTO: "Exento",
  }
  return map[condicion] ?? condicion
}

/** Etiqueta legible para tipo de comprobante */
export function labelTipoComprobante(tipo: string): string {
  const map: Record<string, string> = {
    FACTURA_A: "Factura A",
    FACTURA_B: "Factura B",
    FACTURA_C: "Factura C",
    NOTA_CREDITO_A: "Nota de Crédito A",
    NOTA_CREDITO_B: "Nota de Crédito B",
    NOTA_CREDITO_C: "Nota de Crédito C",
    PRESUPUESTO: "Presupuesto",
  }
  return map[tipo] ?? tipo
}

/** Etiqueta legible para estado de venta */
export function labelEstadoVenta(estado: string): string {
  const map: Record<string, string> = {
    BORRADOR: "Borrador",
    EMITIDA: "Emitida",
    COBRADA: "Cobrada",
    PARCIALMENTE_COBRADA: "Pago parcial",
    ANULADA: "Anulada",
  }
  return map[estado] ?? estado
}

/** Etiqueta legible para medio de pago */
export function labelMedioPago(medio: string): string {
  const map: Record<string, string> = {
    EFECTIVO: "Efectivo",
    TRANSFERENCIA: "Transferencia",
    MERCADOPAGO: "MercadoPago",
    CHEQUE: "Cheque",
    OTROS: "Otros",
  }
  return map[medio] ?? medio
}

/** Número de comprobante formateado: "0001-00000042" */
export function formatNumeroComprobante(puntoVenta: number, numero: number): string {
  return `${String(puntoVenta).padStart(4, "0")}-${String(numero).padStart(8, "0")}`
}
