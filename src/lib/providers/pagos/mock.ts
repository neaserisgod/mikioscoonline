import type { DatosPago, PagosProvider, ResultadoPago } from "./types"

/** Provider mock: genera un link de pago simulado. */
export class MockPagosProvider implements PagosProvider {
  async crearLinkPago(datos: DatosPago): Promise<ResultadoPago> {
    await new Promise((r) => setTimeout(r, 50))

    const preferenceId = `mock-pref-${datos.ventaId}-${Date.now()}`
    const linkPago = `http://localhost:3000/mock-pago?ref=${datos.externalReference}&monto=${datos.montoCentavos}`

    return { linkPago, preferenceId, externalId: preferenceId }
  }
}
