export interface DatosPago {
  ventaId: string
  montoCentavos: number
  descripcion: string
  externalReference: string
  backUrl?: string
}

export interface ResultadoPago {
  linkPago: string
  preferenceId: string
  externalId: string
}

export interface DatosOrdenQr {
  externalPosId: string
  montoCentavos: number
  descripcion: string
  externalReference: string
  /** Minutos hasta que la orden expire sola en MercadoPago si nadie paga. */
  expiracionMinutos: number
}

export interface DatosOrdenPosnet {
  terminalId: string
  montoCentavos: number
  descripcion: string
  externalReference: string
  /** Minutos hasta que la orden expire sola en MercadoPago si nadie paga. */
  expiracionMinutos: number
}

export interface ResultadoOrdenMp {
  orderId: string
}

export interface EstadoOrdenMp {
  pagado: boolean
  /** Cubre expired/failed/canceled — dejó de esperar sin haberse pagado. */
  finalizadoSinPago: boolean
}

export interface PagosProvider {
  crearLinkPago(datos: DatosPago): Promise<ResultadoPago>
  /** Manda el monto real al QR físico (modo híbrido de la API de Orders de MercadoPago). */
  enviarMontoAQr(datos: DatosOrdenQr): Promise<ResultadoOrdenMp>
  /** Consulta si una orden QR ya fue pagada o dejó de esperar. */
  consultarEstadoOrdenQr(orderId: string): Promise<EstadoOrdenMp>
  /** Manda el monto real a la terminal Point para que el cliente pase la tarjeta. */
  enviarMontoAPosnet(datos: DatosOrdenPosnet): Promise<ResultadoOrdenMp>
  /** Consulta si una orden de posnet ya fue pagada o dejó de esperar. */
  consultarEstadoOrdenPosnet(orderId: string): Promise<EstadoOrdenMp>
  /** Solo posnet necesita cancelar de verdad en MercadoPago — libera la terminal física. */
  cancelarOrdenPosnet(orderId: string): Promise<void>
}
