// Interfaz del proveedor de pagos. Mock en dev, MercadoPago en prod.
// TODO: Implementar mp.adapter.ts cuando PAGOS_PROVIDER="mercadopago"

export interface PagoCreado {
  externalId: string
  linkPago?: string
  estado: "pendiente" | "acreditado" | "rechazado"
}

export interface ComisionReal {
  comisionRealCentavos: number
  estado: "acreditado" | "rechazado" | "devuelto"
}

export interface PagosProvider {
  /** Crea un intento de cobro y devuelve el id externo y link de pago (si aplica). */
  crearPago(opts: {
    montoCentavos: number
    descripcion: string
    referencia: string
  }): Promise<PagoCreado>

  /** Consulta el estado real de una transacción (para conciliar comisionRealCentavos). */
  consultarComision(externalId: string): Promise<ComisionReal>
}
