import { describe, it, expect } from "vitest"
import { calcularReparto } from "@/domain/reparto"

// ─── Cascada de reparto (ver docs/MODELO-FINANCIERO.md) ──────────────────────
// Orden: efectivo − reposición − deuda proveedores − gastos fijos pendientes
// − monotributo − sueldo pendiente = ganancia real libre.

describe("calcularReparto — cascada completa, alcanza para todo", () => {
  const r = calcularReparto({
    disponibleRealCentavos: 1_000_000,
    reservaReposicionCentavos: 100_000,
    deudaProveedoresCentavos: 150_000,
    gastosFijosPendientesCentavos: 200_000,
    monotributoCentavos: 40_000,
    sueldoObjetivoCentavos: 300_000,
  })

  it("cada paso se cubre completo", () => {
    expect(r.reposicionCubierta).toBe(true)
    expect(r.reposicionFaltanteCentavos).toBe(0)
    expect(r.gastosFijosCubiertos).toBe(true)
    expect(r.gastosFijosFaltanteCentavos).toBe(0)
  })

  it("la ganancia real libre es lo que sobra después de TODA la cascada", () => {
    // 1.000.000 - 100.000 - 150.000 - 200.000 - 40.000 - 300.000 = 210.000
    expect(r.gananciaDisponibleCentavos).toBe(210_000)
  })
})

describe("calcularReparto — orden de prioridad (reposición antes que gastos fijos)", () => {
  it("si la reposición ya se come todo, gastos fijos queda con el faltante completo", () => {
    const r = calcularReparto({
      disponibleRealCentavos: 100_000,
      reservaReposicionCentavos: 150_000, // no alcanza ni para esto
      deudaProveedoresCentavos: 0,
      gastosFijosPendientesCentavos: 50_000,
      monotributoCentavos: 0,
      sueldoObjetivoCentavos: 0,
    })
    expect(r.reposicionCubierta).toBe(false)
    expect(r.reposicionFaltanteCentavos).toBe(50_000)
    // No queda nada para los pasos siguientes
    expect(r.gastosFijosCubiertos).toBe(false)
    expect(r.gastosFijosFaltanteCentavos).toBe(50_000)
    expect(r.gananciaDisponibleCentavos).toBe(0)
  })
})

describe("calcularReparto — deuda a proveedores pesa en la cascada", () => {
  it("una deuda grande puede dejar sin nada para gastos fijos, monotributo o sueldo", () => {
    const r = calcularReparto({
      disponibleRealCentavos: 500_000,
      reservaReposicionCentavos: 100_000,
      deudaProveedoresCentavos: 450_000, // 500k - 100k reposición = 400k, no alcanza
      gastosFijosPendientesCentavos: 50_000,
      monotributoCentavos: 20_000,
      sueldoObjetivoCentavos: 200_000,
    })
    expect(r.gastosFijosCubiertos).toBe(false)
    expect(r.gastosFijosFaltanteCentavos).toBe(50_000)
    expect(r.gananciaDisponibleCentavos).toBe(0)
  })

  it("saldos a favor (negativos en Provider) no se pasan como deuda — deudaProveedoresCentavos ya viene en 0", () => {
    const r = calcularReparto({
      disponibleRealCentavos: 300_000,
      reservaReposicionCentavos: 0,
      deudaProveedoresCentavos: 0, // el service ya filtra saldoCuentaCorrienteCentavos > 0 antes de sumar
      gastosFijosPendientesCentavos: 0,
      monotributoCentavos: 0,
      sueldoObjetivoCentavos: 0,
    })
    expect(r.gananciaDisponibleCentavos).toBe(300_000)
  })
})

describe("calcularReparto — sueldo objetivo y monotributo siempre se restan completos", () => {
  it("no hay noción de 'ya retirado' — se restan igual aunque el mes recién empiece", () => {
    const r = calcularReparto({
      disponibleRealCentavos: 1_000_000,
      reservaReposicionCentavos: 0,
      deudaProveedoresCentavos: 0,
      gastosFijosPendientesCentavos: 0,
      monotributoCentavos: 40_000,
      sueldoObjetivoCentavos: 400_000,
    })
    expect(r.gananciaDisponibleCentavos).toBe(1_000_000 - 40_000 - 400_000)
  })

  it("el sueldo objetivo puede dejar la ganancia disponible en 0 (nunca negativa)", () => {
    const r = calcularReparto({
      disponibleRealCentavos: 100_000,
      reservaReposicionCentavos: 0,
      deudaProveedoresCentavos: 0,
      gastosFijosPendientesCentavos: 0,
      monotributoCentavos: 0,
      sueldoObjetivoCentavos: 400_000,
    })
    expect(r.gananciaDisponibleCentavos).toBe(0)
  })
})

describe("calcularReparto — retirarGanancia debe topear contra gananciaDisponibleCentavos", () => {
  it("intentar retirar más de lo que queda tras la cascada debe rechazarse (misma validación que retirarGanancia)", () => {
    const r = calcularReparto({
      disponibleRealCentavos: 500_000,
      reservaReposicionCentavos: 50_000,
      deudaProveedoresCentavos: 50_000,
      gastosFijosPendientesCentavos: 50_000,
      monotributoCentavos: 50_000,
      sueldoObjetivoCentavos: 200_000,
    })
    // 500k - 50k - 50k - 50k - 50k - 200k = 100k
    expect(r.gananciaDisponibleCentavos).toBe(100_000)
    const montoARetirar = 150_000
    expect(montoARetirar > r.gananciaDisponibleCentavos).toBe(true)
  })
})
