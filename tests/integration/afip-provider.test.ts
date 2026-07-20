import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { afipClient } from "@/lib/providers/facturacion/afip"

// C3 — antes, facturacionModoProduccion=true en la DB sin AFIP_CERT/AFIP_PRIVATE_KEY
// cargadas en el entorno emitía en HOMOLOGACIÓN sin avisar (el SDK defaultea
// production:false si falta el flag). Ahora afipClient() debe cortar temprano.
// El constructor de Afip (node_modules/@afipsdk/afip.js) es sincrónico — no hace
// ninguna llamada de red, así que este test no toca la red real de AFIP.
describe("afipClient — guard de modo producción sin credenciales", () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    process.env.AFIP_CUIT = "20111111111"
    process.env.AFIP_ACCESS_TOKEN = "token-de-test"
    delete process.env.AFIP_CERT
    delete process.env.AFIP_PRIVATE_KEY
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("modoProduccion=true sin AFIP_CERT/AFIP_PRIVATE_KEY: lanza en vez de degradar a homologación en silencio", () => {
    expect(() => afipClient(true)).toThrow(/AFIP_CERT|AFIP_PRIVATE_KEY/)
  })

  it("modoProduccion=false sin credenciales de producción: no lanza (homologación real, sin certificado)", () => {
    expect(() => afipClient(false)).not.toThrow()
  })

  it("modoProduccion=true CON AFIP_CERT/AFIP_PRIVATE_KEY: no lanza", () => {
    process.env.AFIP_CERT = Buffer.from("cert-fake").toString("base64")
    process.env.AFIP_PRIVATE_KEY = Buffer.from("key-fake").toString("base64")
    expect(() => afipClient(true)).not.toThrow()
  })

  it("sin AFIP_CUIT/AFIP_ACCESS_TOKEN: sigue fallando con el mensaje original (no lo pisa el guard nuevo)", () => {
    delete process.env.AFIP_CUIT
    expect(() => afipClient(false)).toThrow(/AFIP_CUIT/)
  })
})
