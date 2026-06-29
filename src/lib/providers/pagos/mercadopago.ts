import type { DatosPago, PagosProvider, ResultadoPago } from "./types"

/**
 * Provider MercadoPago — STUB para producción.
 *
 * TODO: Integrar el SDK oficial:
 *   npm install mercadopago
 *
 * Variables de entorno necesarias (ver .env.example):
 *   MP_ACCESS_TOKEN, MP_PUBLIC_KEY, MP_WEBHOOK_SECRET
 *
 * Pasos para conectar:
 *   1. npm install mercadopago
 *   2. import { MercadoPagoConfig, Preference } from 'mercadopago'
 *   3. Crear la preferencia con los items de la venta
 *   4. Devolver el init_point como linkPago
 *   5. Configurar webhook en /api/cobros/mp-webhook para confirmar pagos
 */
export class MercadoPagoProvider implements PagosProvider {
  async crearLinkPago(_datos: DatosPago): Promise<ResultadoPago> {
    // TODO: implementar con SDK real
    throw new Error(
      "MercadoPagoProvider no está implementado. " +
      "Usá PAGOS_PROVIDER=mock para desarrollo."
    )
  }
}
