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

export interface PagosProvider {
  crearLinkPago(datos: DatosPago): Promise<ResultadoPago>
}
