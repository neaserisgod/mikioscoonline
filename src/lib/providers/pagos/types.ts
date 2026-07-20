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
  /** El external_reference que se mandó al crear la orden (organizationId:uuid,
   * ver pagos.actions.ts) — permite verificar que quien consulta/cancela sea
   * dueño de la orden antes de actuar (ver hallazgo A1). */
  externalReference?: string
  /** Al menos un intento de pago fue rechazado (tarjeta declinada, etc.) — la
   * orden puede seguir abierta esperando otro intento, pero el cajero debe
   * enterarse ahora, no recién cuando venza el timeout de 5 minutos (ver
   * hallazgo M3). */
  rechazado?: boolean
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
  /** Cancela una orden de posnet — libera la terminal física, que si no queda
   * esperando la tarjeta indefinidamente. */
  cancelarOrdenPosnet(orderId: string): Promise<void>
  /** Cancela una orden de QR. Necesario cuando el `external_pos_id` está
   * atado a una terminal Point real (no un POS suelto sin dispositivo) — esa
   * terminal también queda mostrando algo en pantalla hasta que se cancela. */
  cancelarOrdenQr(orderId: string): Promise<void>
}
