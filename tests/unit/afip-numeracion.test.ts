import { describe, it, expect, vi } from "vitest"
import { crearProximoComprobanteConReintento, esRechazoPorNumeroYaUsado } from "@/lib/providers/facturacion/afip"

// A5 — Afip.ElectronicBilling.createNextVoucher hace getLastVoucher +
// createVoucher en dos pasos NO atómicos: dos facturaciones concurrentes
// para el mismo PtoVta/tipo pueden leer el mismo "último número" y competir
// por el mismo CbteDesde. Antes, quien perdía la carrera quedaba en ERROR
// hasta el próximo ciclo del cron — ahora se reintenta pidiendo el próximo
// número de nuevo.

function fakeAfip(opts: { getLastVoucherSecuencia: number[]; createVoucherImpl: (voucherNumber: number) => Promise<unknown> }) {
  let llamada = 0
  return {
    ElectronicBilling: {
      getLastVoucher: vi.fn(async () => opts.getLastVoucherSecuencia[llamada++] ?? opts.getLastVoucherSecuencia.at(-1)),
      createVoucher: vi.fn(async (data: { CbteDesde: number }) => opts.createVoucherImpl(data.CbteDesde)),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe("esRechazoPorNumeroYaUsado", () => {
  it("code 10016 (número): true", () => {
    expect(esRechazoPorNumeroYaUsado({ code: 10016, message: "algo" })).toBe(true)
  })

  it("code '10016' (string): true", () => {
    expect(esRechazoPorNumeroYaUsado({ code: "10016", message: "algo" })).toBe(true)
  })

  it("mensaje con 'comprobante' + 'autorizado' sin code conocido: true (fallback por texto)", () => {
    expect(esRechazoPorNumeroYaUsado({ message: "El comprobante Nro 5 ya fue autorizado anteriormente" })).toBe(true)
  })

  it("otro error de WSFE no relacionado: false", () => {
    expect(esRechazoPorNumeroYaUsado({ code: 600, message: "CUIT representado no incluido en Token" })).toBe(false)
  })

  it("no es un objeto con esas propiedades: false, no revienta", () => {
    expect(esRechazoPorNumeroYaUsado("un string")).toBe(false)
    expect(esRechazoPorNumeroYaUsado(undefined)).toBe(false)
  })
})

describe("crearProximoComprobanteConReintento", () => {
  it("sin conflicto: pide el último número una vez y emite con el siguiente", async () => {
    const afip = fakeAfip({
      getLastVoucherSecuencia: [5],
      createVoucherImpl: async () => ({ CAE: "cae-1", CAEFchVto: "2026-08-01" }),
    })

    const res = await crearProximoComprobanteConReintento(afip, { PtoVta: 2, CbteTipo: 11 })

    expect(res).toEqual({ CAE: "cae-1", CAEFchVto: "2026-08-01", voucherNumber: 6 })
    expect(afip.ElectronicBilling.getLastVoucher).toHaveBeenCalledTimes(1)
    expect(afip.ElectronicBilling.createVoucher).toHaveBeenCalledTimes(1)
  })

  it("carrera real: el primer intento choca (número ya usado), reintenta con el próximo y gana", async () => {
    const errorNumeroUsado = Object.assign(new Error("(10016) El comprobante ya fue autorizado"), { code: 10016 })
    const afip = fakeAfip({
      getLastVoucherSecuencia: [5, 6], // otra facturación ya emitió el 6 entre medio
      createVoucherImpl: vi.fn()
        .mockRejectedValueOnce(errorNumeroUsado)
        .mockResolvedValueOnce({ CAE: "cae-2", CAEFchVto: "2026-08-01" }) as never,
    })

    const res = await crearProximoComprobanteConReintento(afip, { PtoVta: 2, CbteTipo: 11 })

    expect(res).toEqual({ CAE: "cae-2", CAEFchVto: "2026-08-01", voucherNumber: 7 })
    expect(afip.ElectronicBilling.getLastVoucher).toHaveBeenCalledTimes(2)
    expect(afip.ElectronicBilling.createVoucher).toHaveBeenCalledTimes(2)
  })

  it("error NO relacionado a numeración: no reintenta, propaga de inmediato", async () => {
    const errorNoRelacionado = Object.assign(new Error("(600) CUIT representado no incluido en Token"), { code: 600 })
    const afip = fakeAfip({
      getLastVoucherSecuencia: [5],
      createVoucherImpl: async () => { throw errorNoRelacionado },
    })

    await expect(crearProximoComprobanteConReintento(afip, { PtoVta: 2, CbteTipo: 11 })).rejects.toBe(errorNoRelacionado)
    expect(afip.ElectronicBilling.createVoucher).toHaveBeenCalledTimes(1)
  })

  it("agota los reintentos (carrera persistente): propaga el último error, no reintenta indefinidamente", async () => {
    const errorNumeroUsado = Object.assign(new Error("(10016) El comprobante ya fue autorizado"), { code: 10016 })
    const afip = fakeAfip({
      getLastVoucherSecuencia: [5, 6, 7],
      createVoucherImpl: async () => { throw errorNumeroUsado },
    })

    await expect(crearProximoComprobanteConReintento(afip, { PtoVta: 2, CbteTipo: 11 })).rejects.toBe(errorNumeroUsado)
    expect(afip.ElectronicBilling.createVoucher).toHaveBeenCalledTimes(3) // MAX_INTENTOS_NUMERACION
  })
})
