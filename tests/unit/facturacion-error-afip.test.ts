import { describe, it, expect } from "vitest"
import { mensajeDeErrorAfip } from "@/services/facturacion.service"

// Antes, guardarError() solo persistía e.message — para un error HTTP de
// AfipSDK (app.afipsdk.com) eso es el genérico de axios ("Request failed
// with status code 400"), no la razón real (que vive en error.data.message).
// mensajeDeErrorAfip() es lo que lee ambas cosas — ver afip.ts para cómo se
// adjuntan status/statusText/data al Error que se relanza.
describe("mensajeDeErrorAfip", () => {
  it("combina el mensaje genérico de axios con el detalle real de error.data.message", () => {
    const err = Object.assign(new Error("Request failed with status code 400"), {
      status: 400,
      statusText: "Bad Request",
      data: { message: "El CUIT informado no es válido" },
    })
    expect(mensajeDeErrorAfip(err)).toBe(
      "Request failed with status code 400 — El CUIT informado no es válido — HTTP 400 Bad Request"
    )
  })

  it("error.data como string plano (no objeto) también se usa", () => {
    const err = Object.assign(new Error("Request failed with status code 400"), {
      status: 400,
      data: "Punto de venta no encontrado",
    })
    expect(mensajeDeErrorAfip(err)).toBe("Request failed with status code 400 — Punto de venta no encontrado — HTTP 400")
  })

  it("sin status/data (error genérico de JS): solo el mensaje, sin romper", () => {
    expect(mensajeDeErrorAfip(new Error("Faltan datos fiscales"))).toBe("Faltan datos fiscales")
  })

  it("data.message idéntico a message: no lo duplica", () => {
    const err = Object.assign(new Error("Mismo texto"), { data: { message: "Mismo texto" } })
    expect(mensajeDeErrorAfip(err)).toBe("Mismo texto")
  })

  it("no es una instancia de Error: mensaje genérico, no revienta", () => {
    expect(mensajeDeErrorAfip("un string cualquiera")).toBe("Error desconocido al facturar")
    expect(mensajeDeErrorAfip(undefined)).toBe("Error desconocido al facturar")
  })
})
