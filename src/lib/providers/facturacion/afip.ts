import type { DatosFactura, FacturacionProvider, ResultadoFacturacion } from "./types"

/**
 * Provider AFIP/ARCA — STUB para producción.
 *
 * TODO: Integrar un SDK real, por ejemplo:
 *   - @afipsdk/afip.js (https://github.com/afipsdk/afip.js)
 *   - tusFacturas API (https://developers.tusfacturas.app)
 *
 * Variables de entorno necesarias (ver .env.example):
 *   AFIP_CUIT, AFIP_CERT, AFIP_PRIVATE_KEY, AFIP_ENVIRONMENT
 *
 * Pasos para conectar el SDK real:
 *   1. npm install @afipsdk/afip.js (o el SDK que elijas)
 *   2. Reemplazar el throw de abajo por la llamada real
 *   3. Mapear DatosFactura → formato del SDK
 *   4. Parsear la respuesta del SDK → ResultadoFacturacion
 */
export class AfipFacturacionProvider implements FacturacionProvider {
  async emitir(_datos: DatosFactura): Promise<ResultadoFacturacion> {
    // TODO: implementar con SDK real
    throw new Error(
      "AfipFacturacionProvider no está implementado. " +
      "Usá FACTURACION_PROVIDER=mock para desarrollo."
    )
  }
}
