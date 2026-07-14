export interface ItemFactura {
  descripcion: string
  cantidad: number
  precioUnitarioCentavos: number
  alicuotaIVA: number
  netoCentavos: number
  ivaCentavos: number
  subtotalCentavos: number
}

export interface DatosFactura {
  tipo: string
  puntoVenta: number
  numero: number
  fechaEmision: Date
  cuit: string
  razonSocial: string
  condicionIVAEmisor: string
  cuitCliente?: string
  razonSocialCliente: string
  condicionIVACliente: string
  items: ItemFactura[]
  subtotalCentavos: number
  ivaTotalCentavos: number
  totalCentavos: number
  // false = homologación (comprobante de prueba), true = producción real (CAE
  // real, no anulable). Viene de Organization.facturacionModoProduccion.
  modoProduccion: boolean
}

export interface ResultadoFacturacion {
  cae: string
  caeFechaVencimiento: Date
  numeroComprobante: number
}

export interface FacturacionProvider {
  emitir(datos: DatosFactura): Promise<ResultadoFacturacion>
}
