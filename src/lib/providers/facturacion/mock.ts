import type { DatosFactura, FacturacionProvider, ResultadoFacturacion } from "./types"

/** Provider mock: genera CAE y número simulados. No requiere certificados AFIP. */
export class MockFacturacionProvider implements FacturacionProvider {
  async emitir(datos: DatosFactura): Promise<ResultadoFacturacion> {
    // CAE simulado: 14 dígitos aleatorios
    const cae = String(Math.floor(Math.random() * 1e14)).padStart(14, "0")

    // Vence 10 días corridos desde emisión
    const caeFechaVencimiento = new Date(datos.fechaEmision)
    caeFechaVencimiento.setDate(caeFechaVencimiento.getDate() + 10)

    // Simula latencia de API
    await new Promise((r) => setTimeout(r, 100))

    return {
      cae,
      caeFechaVencimiento,
      numeroComprobante: datos.numero,
    }
  }
}
