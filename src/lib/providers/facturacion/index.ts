import type { FacturacionProvider } from "./types"
import { MockFacturacionProvider } from "./mock"
import { AfipFacturacionProvider } from "./afip"

export type { FacturacionProvider, DatosFactura, ResultadoFacturacion } from "./types"

let _provider: FacturacionProvider | null = null

export function getFacturacionProvider(): FacturacionProvider {
  if (_provider) return _provider

  const env = process.env.FACTURACION_PROVIDER ?? "mock"

  if (env === "afip") {
    _provider = new AfipFacturacionProvider()
  } else {
    _provider = new MockFacturacionProvider()
  }

  return _provider
}
