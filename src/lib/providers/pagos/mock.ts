import type {
  DatosOrdenPosnet,
  DatosOrdenQr,
  DatosPago,
  EstadoOrdenMp,
  PagosProvider,
  ResultadoOrdenMp,
  ResultadoPago,
} from "./types"

/** Provider mock: genera un link de pago simulado. */
export class MockPagosProvider implements PagosProvider {
  async crearLinkPago(datos: DatosPago): Promise<ResultadoPago> {
    await new Promise((r) => setTimeout(r, 50))

    const preferenceId = `mock-pref-${datos.ventaId}-${Date.now()}`
    const linkPago = `http://localhost:3000/mock-pago?ref=${datos.externalReference}&monto=${datos.montoCentavos}`

    return { linkPago, preferenceId, externalId: preferenceId }
  }

  async enviarMontoAQr(_datos: DatosOrdenQr): Promise<ResultadoOrdenMp> {
    await new Promise((r) => setTimeout(r, 50))
    // El timestamp queda embebido en el id para poder simular el pago en consultarEstadoOrdenQr
    // sin necesitar estado compartido entre llamadas.
    return { orderId: `mock-order-${Date.now()}` }
  }

  async consultarEstadoOrdenQr(orderId: string): Promise<EstadoOrdenMp> {
    await new Promise((r) => setTimeout(r, 50))
    const creadoEn = Number(orderId.split("-").pop())
    // Simula el pago confirmado ~4s después de creada la orden, para poder probar
    // el flujo de espera completo en dev sin depender de MercadoPago real.
    const pagado = Number.isFinite(creadoEn) && Date.now() - creadoEn > 4000
    return { pagado, finalizadoSinPago: false }
  }

  // El posnet reusa el mismo simulacro que el QR (mismo ciclo de espera/confirmación),
  // solo cambia de dónde sale el orderId.
  async enviarMontoAPosnet(datos: DatosOrdenPosnet): Promise<ResultadoOrdenMp> {
    return this.enviarMontoAQr({ ...datos, externalPosId: datos.terminalId })
  }

  async consultarEstadoOrdenPosnet(orderId: string): Promise<EstadoOrdenMp> {
    return this.consultarEstadoOrdenQr(orderId)
  }

  async cancelarOrdenPosnet(_orderId: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 50))
  }
}
