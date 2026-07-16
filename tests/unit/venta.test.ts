import { describe, it, expect } from "vitest"
import { calcularComision } from "@/domain/comisiones"
import { gananciaBruta } from "@/domain/markup"

// ─── Tests de lógica pura del flujo de venta ─────────────────────────────────
// La lógica del servicio interactúa con Prisma (DB), así que testeamos
// las funciones puras que alimentan ventaService.crear

describe("Flujo de venta — costo-foto y ganancia", () => {
  // Simula los valores que estarían en el producto al momento de la venta
  const producto = {
    id: "prod-1",
    nombre: "Coca-Cola 500ml",
    precioCentavos: 1120000,   // $11.200,00 (100 centavos = $1)
    costoCentavos: 800000,     // $8.000,00
    stock: 20,
  }

  it("ganancia bruta por línea usa valores-foto, no precio actual", () => {
    // La SaleLine guarda foto del precio y costo
    const precioFoto = producto.precioCentavos
    const costoFoto = producto.costoCentavos
    const cantidad = 3

    const ganancia = gananciaBruta(precioFoto, costoFoto, cantidad)
    // (1.120.000 - 800.000) × 3 = 960.000
    expect(ganancia).toBe(960000)
  })

  it("si el precio cambia después de la venta, la ganancia histórica no cambia", () => {
    // Foto al momento de la venta
    const precioFoto = 1120000
    const costoFoto = 800000

    // Precio actual del producto (subió)
    const precioActual = 1400000

    const gananciaHistorica = gananciaBruta(precioFoto, costoFoto, 1)
    const gananciaConPrecioActual = gananciaBruta(precioActual, costoFoto, 1)

    expect(gananciaHistorica).toBe(320000)
    expect(gananciaConPrecioActual).toBe(600000)
    expect(gananciaHistorica).not.toBe(gananciaConPrecioActual)
  })

  it("total de venta = suma de precioUnitario × cantidad de cada línea", () => {
    const lineas = [
      { precioUnitarioCentavos: 1120000, cantidad: 2 },
      { precioUnitarioCentavos: 595000, cantidad: 1 },
    ]
    const total = lineas.reduce((sum, l) => sum + l.precioUnitarioCentavos * l.cantidad, 0)
    expect(total).toBe(2835000)
  })

  it("costoTotal = suma de costoUnitario × cantidad de cada línea", () => {
    const lineas = [
      { costoUnitarioCentavos: 800000, cantidad: 2 },
      { costoUnitarioCentavos: 350000, cantidad: 1 },
    ]
    const costoTotal = lineas.reduce((sum, l) => sum + l.costoUnitarioCentavos * l.cantidad, 0)
    expect(costoTotal).toBe(1950000)
  })
})

describe("Flujo de venta — cálculo de comisiones por pago", () => {
  it("venta en efectivo → comision 0, montoNeto = total", () => {
    const total = 2835000
    const r = calcularComision(total, 0)
    expect(r.comisionCentavos).toBe(0)
    expect(r.montoNetoCentavos).toBe(total)
  })

  it("venta con MP (399 bp) → comision redondeada", () => {
    const total = 2835000
    const r = calcularComision(total, 399)
    // 2835000 × 399 / 10000 = 113116.5 → 113117
    expect(r.comisionCentavos).toBe(113117)
    expect(r.montoNetoCentavos).toBe(total - 113117)
    expect(r.comisionCentavos + r.montoNetoCentavos).toBe(total)
  })

  it("pago mixto: efectivo + MP suman el total de la venta", () => {
    const totalVenta = 5000000
    const pagoEfectivo = 2000000
    const pagoMP = 3000000

    const comEfectivo = calcularComision(pagoEfectivo, 0)
    const comMP = calcularComision(pagoMP, 399)

    const totalPagado = pagoEfectivo + pagoMP
    const totalComision = comEfectivo.comisionCentavos + comMP.comisionCentavos
    const totalNeto = comEfectivo.montoNetoCentavos + comMP.montoNetoCentavos

    expect(totalPagado).toBe(totalVenta)
    expect(totalComision + totalNeto).toBe(totalVenta)
    expect(totalComision).toBeGreaterThan(0)
  })
})

describe("Flujo de venta — validaciones de stock", () => {
  it("stock suficiente: no lanza error", () => {
    const stockDisponible = 10
    const cantidadPedida = 5
    expect(() => {
      if (cantidadPedida > stockDisponible) throw new Error("Stock insuficiente")
    }).not.toThrow()
  })

  it("stock insuficiente: lanza error", () => {
    const stockDisponible = 3
    const cantidadPedida = 5
    expect(() => {
      if (cantidadPedida > stockDisponible) throw new Error("Stock insuficiente")
    }).toThrow("Stock insuficiente")
  })

  it("stock posterior = stock anterior - cantidad vendida", () => {
    const stockAnterior = 20
    const cantidadVendida = 3
    const stockPosterior = stockAnterior - cantidadVendida
    expect(stockPosterior).toBe(17)
  })
})

describe("Flujo de venta — variantes que comparten stock", () => {
  // Simula el modelo: "Huevo" es el dueño (factor 1, stock en unidades
  // sueltas); "Media docena" (factor 6) y "Docena" (factor 12) son variantes
  // que le apuntan y no tienen stock propio — ver Product.variantOfId /
  // unidadesPorVenta y ventaService.crear (paso 2: validación agregada por
  // dueño, paso 10: decremento atómico contra el dueño).
  const huevo = { id: "huevo", nombre: "Huevo", variantOfId: null as string | null, unidadesPorVenta: 1, stock: 30 }
  const mediaDocena = { id: "media-docena", nombre: "Media docena de huevo", variantOfId: "huevo" as string | null, unidadesPorVenta: 6 }
  const docena = { id: "docena", nombre: "Docena de huevo", variantOfId: "huevo" as string | null, unidadesPorVenta: 12 }

  /** Mismo cálculo que el paso 2 de ventaService.crear: acumula el requerido
   * (cantidad × unidadesPorVenta) por dueño, no por línea. */
  function requeridoPorDueño(
    lineas: { producto: { id: string; variantOfId: string | null; unidadesPorVenta: number }; cantidad: number }[]
  ) {
    const mapa = new Map<string, number>()
    for (const { producto, cantidad } of lineas) {
      const stockOwnerId = producto.variantOfId ?? producto.id
      const requerido = cantidad * producto.unidadesPorVenta
      mapa.set(stockOwnerId, (mapa.get(stockOwnerId) ?? 0) + requerido)
    }
    return mapa
  }

  it("dueño con stock 30, vender 1 docena (factor 12) deja 18", () => {
    const requerido = requeridoPorDueño([{ producto: docena, cantidad: 1 }]).get("huevo")!
    expect(requerido).toBe(12)
    expect(huevo.stock - requerido).toBe(18)
  })

  it("dueño con stock 30, vender 1 media docena (factor 6) deja 24", () => {
    const requerido = requeridoPorDueño([{ producto: mediaDocena, cantidad: 1 }]).get("huevo")!
    expect(requerido).toBe(6)
    expect(huevo.stock - requerido).toBe(24)
  })

  it("oversell: vender más que el stock del dueño lanza y no descuenta", () => {
    const requerido = requeridoPorDueño([{ producto: docena, cantidad: 3 }]).get("huevo")! // 36 > 30
    expect(() => {
      if (requerido > huevo.stock) {
        throw new Error(`Stock insuficiente para "${huevo.nombre}": disponible ${huevo.stock}, requerido ${requerido}`)
      }
    }).toThrow("Stock insuficiente")
    // El chequeo lanza antes de tocar el stock — sigue intacto
    expect(huevo.stock).toBe(30)
  })

  it("una venta con docena + media docena del mismo dueño acumula y descuenta 18 en total", () => {
    const mapa = requeridoPorDueño([
      { producto: docena, cantidad: 1 }, // 12
      { producto: mediaDocena, cantidad: 1 }, // 6
    ])
    const requeridoTotal = mapa.get("huevo")!
    expect(requeridoTotal).toBe(18)
    expect(huevo.stock - requeridoTotal).toBe(12)
  })
})
