import { describe, it, expect } from "vitest"
import { Prisma } from "@prisma/client"
import { calcEfectivoEsperado } from "@/services/cajaSesion.service"

// ─── Test del patrón de idempotencia por id (replay ante carrera P2002) ──────
// cajaSesionService.abrirCaja/registrarMovimiento interactúan con Prisma (DB
// real, transacción), así que — mismo criterio que venta.test.ts — no se
// mockea Prisma entero acá. En su lugar se reproduce el patrón EXACTO que usan
// esos métodos (y ventaService.crear) contra una tabla fake en memoria con
// restricción de unicidad por id, para validar la propiedad real que importa:
// dos intentos concurrentes con el mismo `id` nunca deben duplicar la fila ni
// hacer que uno de los dos falle con un error crudo de PK duplicada.

/** Emula una tabla con PK única — igual que Prisma, un segundo `crear` con el
 * mismo id tira PrismaClientKnownRequestError(P2002) en vez de sobreescribir. */
function tablaFake<T extends { id: string }>() {
  const filas = new Map<string, T>()
  return {
    buscar: async (id: string): Promise<T | null> => filas.get(id) ?? null,
    crear: async (fila: T): Promise<T> => {
      if (filas.has(fila.id)) {
        throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        })
      }
      filas.set(fila.id, fila)
      return fila
    },
  }
}

/** Mismo patrón que cajaSesionService.abrirCaja/registrarMovimiento y
 * ventaService.crear: replay dentro de la "transacción" (buscar antes de
 * crear) + captura de P2002 afuera para la carrera de dos intentos en vuelo a
 * la vez. */
async function crearIdempotente<T extends { id: string }>(
  tabla: ReturnType<typeof tablaFake<T>>,
  id: string,
  construir: () => T
): Promise<T> {
  const ejecutar = async () => {
    const existente = await tabla.buscar(id)
    if (existente) return existente
    return tabla.crear(construir())
  }

  try {
    return await ejecutar()
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existente = await tabla.buscar(id)
      if (!existente) throw error
      return existente
    }
    throw error
  }
}

describe("Idempotencia por id — replay ante carrera (abrirCaja / registrarMovimiento)", () => {
  it("llamar dos veces (secuencial) con el mismo id devuelve la misma fila, sin duplicar", async () => {
    const tabla = tablaFake<{ id: string; monto: number }>()
    const construir = () => ({ id: "mov-1", monto: 500000 })

    const primera = await crearIdempotente(tabla, "mov-1", construir)
    const segunda = await crearIdempotente(tabla, "mov-1", construir)

    expect(segunda).toEqual(primera)
    expect(await tabla.buscar("mov-1")).toEqual(primera)
  })

  it("carrera real: dos intentos concurrentes con el mismo id resuelven ambos OK, sin duplicar ni propagar el error de PK", async () => {
    const tabla = tablaFake<{ id: string; monto: number }>()
    const construir = () => ({ id: "mov-2", monto: 123000 })

    // Ambos arrancan antes de que el primero termine de escribir — el segundo
    // "buscar" del paso de replay todavía no ve nada, así que los dos intentan
    // `crear` y el que pierde choca con la PK duplicada (P2002), exactamente
    // la carrera que dejaba pasar el código viejo.
    const [a, b] = await Promise.all([
      crearIdempotente(tabla, "mov-2", construir),
      crearIdempotente(tabla, "mov-2", construir),
    ])

    expect(a).toEqual(b)
    expect(a.id).toBe("mov-2")
  })

  it("P2002 sin fila existente (otro conflicto real, no un replay) vuelve a lanzar el error", async () => {
    const tabla = tablaFake<{ id: string; monto: number }>()
    // Simula P2002 por OTRO motivo (ej. constraint distinta) donde buscar(id)
    // no encuentra nada — no debe tragarse el error como si fuera idempotencia.
    const tablaQueSiempreFalla = {
      ...tabla,
      crear: async (): Promise<{ id: string; monto: number }> => {
        throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        })
      },
    }

    await expect(
      crearIdempotente(tablaQueSiempreFalla, "mov-3", () => ({ id: "mov-3", monto: 1 }))
    ).rejects.toThrow("Unique constraint failed")
  })

  it("un error que no es P2002 se propaga tal cual (no se confunde con idempotencia)", async () => {
    const tabla = {
      buscar: async () => null,
      crear: async (): Promise<{ id: string }> => {
        throw new Error("Abrí la Caja general — ya tiene una sesión abierta")
      },
    }

    await expect(
      crearIdempotente(tabla, "mov-4", () => ({ id: "mov-4" }))
    ).rejects.toThrow("ya tiene una sesión abierta")
  })
})

// ─── calcEfectivoEsperado — el recargo de QR/Posnet suma al esperado ─────────
// El recargo por cigarrillos llega junto con el resto del pago a la MISMA
// cuenta de MercadoPago (no es una transacción aparte) — antes del fix quedaba
// afuera del "esperado" y cada cierre de la caja digital mostraba una
// diferencia fantasma del tamaño del recargo acumulado (ver revisión de la
// caja QR/Posnet). Estos tests cubren que el fix suma bien y que el
// comportamiento sin recargo (el caso de siempre) no cambió.
describe("calcEfectivoEsperado — recargo de QR/Posnet en el esperado", () => {
  const medioMp = { esEfectivo: false }
  const medioEfectivo = { esEfectivo: true }

  it("una VENTA con recargoCentavos > 0 suma monto + recargo al esperado (caja digital)", () => {
    const esperado = calcEfectivoEsperado(
      0,
      [{ tipo: "VENTA", montoCentavos: 30000, recargoCentavos: 5000, medioPago: medioMp }],
      false // caja 100% digital (ej. MercadoPago) — manejaEfectivo: false
    )
    expect(esperado).toBe(35000)
  })

  it("una VENTA con recargo 0 se comporta igual que antes del fix (sin regresión)", () => {
    const esperado = calcEfectivoEsperado(
      100000, // fondo inicial
      [
        { tipo: "VENTA", montoCentavos: 46000, recargoCentavos: 0, medioPago: medioEfectivo },
        { tipo: "INGRESO", montoCentavos: 10000, recargoCentavos: 0, medioPago: null },
        { tipo: "EGRESO", montoCentavos: 5000, recargoCentavos: 0, medioPago: null },
      ],
      true // caja de efectivo
    )
    // 100000 (fondo) + 46000 (venta efectivo) + 10000 (ingreso) - 5000 (egreso)
    expect(esperado).toBe(151000)
  })

  it("caja de efectivo: una VENTA no-efectivo con recargo no cuenta ni por el monto ni por el recargo", () => {
    const esperado = calcEfectivoEsperado(
      0,
      [{ tipo: "VENTA", montoCentavos: 30000, recargoCentavos: 5000, medioPago: medioMp }],
      true // caja de efectivo (manejaEfectivo: true) — solo cuenta lo pagado en efectivo
    )
    expect(esperado).toBe(0)
  })

  it("caja que NO maneja efectivo (manejaEfectivo: false) sigue sumando ventas mixtas + recargo correctamente", () => {
    const esperado = calcEfectivoEsperado(
      20000, // fondo inicial (saldo arrastrado del último cierre)
      [
        { tipo: "VENTA", montoCentavos: 30000, recargoCentavos: 3000, medioPago: medioMp },
        { tipo: "VENTA", montoCentavos: 12000, recargoCentavos: 0, medioPago: medioMp },
      ],
      false
    )
    // 20000 + (30000 + 3000) + (12000 + 0)
    expect(esperado).toBe(65000)
  })
})
