import type { PagosProvider } from "./types"
import { MockPagosProvider } from "./mock"
import { MercadoPagoProvider } from "./mercadopago"

export type {
  PagosProvider,
  DatosPago,
  ResultadoPago,
  DatosOrdenQr,
  DatosOrdenPosnet,
  ResultadoOrdenMp,
  EstadoOrdenMp,
} from "./types"

let _provider: PagosProvider | null = null

export function getPagosProvider(): PagosProvider {
  if (_provider) return _provider

  const env = process.env.PAGOS_PROVIDER ?? "mock"

  if (env === "mercadopago") {
    _provider = new MercadoPagoProvider()
  } else {
    _provider = new MockPagosProvider()
  }

  return _provider
}
