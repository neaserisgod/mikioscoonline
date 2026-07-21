import { describe, it, expect } from "vitest"
import { calcularTotalesCaja } from "@/domain/caja"

// El recargo por cigarrillos (QR/Posnet) llega junto con el resto del pago a
// la MISMA cuenta de MercadoPago, no es una transacción aparte — antes del
// fix quedaba afuera del total y cada cierre de la caja digital mostraba una
// diferencia fantasma del tamaño del recargo acumulado (ver revisión de la
// caja QR/Posnet). Esta fórmula vivía duplicada en cajaSesion.service.ts
// (server) y dashboard-client.tsx (panel de Inicio) — acá es la fuente única,
// consumida por los dos.
describe("calcularTotalesCaja", () => {
  const medioMp = { esEfectivo: false }
  const medioEfectivo = { esEfectivo: true }

  it("una VENTA con recargoCentavos > 0 suma monto + recargo al total (caja digital)", () => {
    const t = calcularTotalesCaja(
      [{ tipo: "VENTA", montoCentavos: 30000, recargoCentavos: 5000, medioPago: medioMp }],
      0,
      false // caja 100% digital (ej. MercadoPago) — manejaEfectivo: false
    )
    expect(t.total).toBe(35000)
    expect(t.recargo).toBe(5000)
  })

  it("una VENTA con recargo 0 se comporta igual que antes del fix (sin regresión)", () => {
    const t = calcularTotalesCaja(
      [
        { tipo: "VENTA", montoCentavos: 46000, recargoCentavos: 0, medioPago: medioEfectivo },
        { tipo: "INGRESO", montoCentavos: 10000, recargoCentavos: 0, medioPago: null },
        { tipo: "EGRESO", montoCentavos: 5000, recargoCentavos: 0, medioPago: null },
      ],
      100000, // fondo inicial
      true // caja de efectivo
    )
    // 100000 (fondo) + 46000 (venta efectivo) + 10000 (ingreso) - 5000 (egreso)
    expect(t.total).toBe(151000)
    expect(t.recargo).toBe(0)
  })

  it("caja de efectivo: una VENTA no-efectivo con recargo no cuenta ni por el monto ni por el recargo", () => {
    const t = calcularTotalesCaja(
      [{ tipo: "VENTA", montoCentavos: 30000, recargoCentavos: 5000, medioPago: medioMp }],
      0,
      true // caja de efectivo (manejaEfectivo: true) — solo cuenta lo pagado en efectivo
    )
    expect(t.total).toBe(0)
    // El desglose sigue mostrando la venta digital — solo `total` la excluye.
    expect(t.ventasDigital).toBe(30000)
  })

  it("caja que NO maneja efectivo (manejaEfectivo: false) suma ventas mixtas + recargo correctamente", () => {
    const t = calcularTotalesCaja(
      [
        { tipo: "VENTA", montoCentavos: 30000, recargoCentavos: 3000, medioPago: medioMp },
        { tipo: "VENTA", montoCentavos: 12000, recargoCentavos: 0, medioPago: medioMp },
      ],
      20000, // fondo inicial (saldo arrastrado del último cierre)
      false
    )
    // 20000 + (30000 + 3000) + (12000 + 0)
    expect(t.total).toBe(65000)
  })

  // Caso del panel de Inicio (computeSessionTotals, dashboard-client.tsx):
  // ventas efectivo + digital mezcladas en la MISMA sesión, con recargo solo
  // en las digitales — antes no se podía testear porque importar el archivo
  // del panel para llegar a la función rompía (arrastraba next-auth vía la
  // cadena de imports de la app). Con la fórmula en domain/, se cubre directo.
  it("desglose completo con ventas mixtas — mismo caso que usa el panel de Inicio (manejaEfectivo: false)", () => {
    const t = calcularTotalesCaja(
      [
        { tipo: "VENTA", montoCentavos: 20000, recargoCentavos: 0, medioPago: medioEfectivo },
        { tipo: "VENTA", montoCentavos: 30000, recargoCentavos: 3000, medioPago: medioMp },
        { tipo: "INGRESO", montoCentavos: 1000, recargoCentavos: 0, medioPago: null },
        { tipo: "EGRESO", montoCentavos: 500, recargoCentavos: 0, medioPago: null },
      ],
      0,
      false
    )
    expect(t.ventasEfectivo).toBe(20000)
    expect(t.ventasDigital).toBe(30000)
    expect(t.recargo).toBe(3000)
    expect(t.ingresos).toBe(1000)
    expect(t.egresos).toBe(500)
    expect(t.nVentas).toBe(2)
    // 20000 + 30000 + 3000 (recargo) + 1000 - 500
    expect(t.total).toBe(53500)
  })

  it("movimiento sin medioPago (null) se trata como no-efectivo, sin romper", () => {
    const t = calcularTotalesCaja(
      [{ tipo: "VENTA", montoCentavos: 10000, recargoCentavos: 0, medioPago: null }],
      0,
      false
    )
    expect(t.ventasDigital).toBe(10000)
    expect(t.ventasEfectivo).toBe(0)
    expect(t.total).toBe(10000)
  })
})
