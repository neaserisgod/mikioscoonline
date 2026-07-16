import type { ImpresionProvider } from "./types"
import { MercadoPagoTerminalProvider } from "./mercadopago-terminal"

export type { ImpresionProvider } from "./types"

let _provider: ImpresionProvider | null = null

/** Único provider hoy (terminal Point de MercadoPago) — mismo patrón factory
 * que providers/facturacion, para poder sumar otro hardware de impresión sin
 * tocar impresion.service.ts. */
export function getImpresionProvider(): ImpresionProvider {
  if (!_provider) _provider = new MercadoPagoTerminalProvider()
  return _provider
}
