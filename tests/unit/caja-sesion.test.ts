import { describe, it, expect } from "vitest"
import { Prisma } from "@prisma/client"

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
