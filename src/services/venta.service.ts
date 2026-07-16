import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { calcularComision } from "@/domain/comisiones"
import { calcularRecargoCigarrillos } from "@/domain/recargo-cigarrillos"
import { resolverCajaId } from "@/domain/cajas"
import { precioUnitarioEfectivo, costoUnitarioEfectivo, subtotalLinea } from "@/domain/pesables"
import { facturacionService } from "@/services/facturacion.service"
import { impresionService } from "@/services/impresion.service"
import { logError } from "@/lib/log"

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface LineaVentaInput {
  productId: string
  cantidad: number
  /** Solo para productos pesables: gramos vendidos. */
  gramos?: number
}

export interface PagoInput {
  paymentMethodId: string
  montoCentavos: number
  /** orderId de MercadoPago u otra referencia externa (opcional). */
  referencia?: string
}

export interface CrearVentaInput {
  /** Id generado por el cliente (uuid v4) para reintentos idempotentes desde una cola offline. */
  id?: string
  userId: string
  organizationId: string
  lineas: LineaVentaInput[]
  pagos: PagoInput[]
  /** Descuento manual del cajero, en centavos, sobre el subtotal de productos. */
  descuentoCentavos?: number
  /** Consumo de personal o del dueño — no es una venta real a un cliente: no
   * suma al fondo de reposición del proveedor ni a las cifras de ganancia. */
  esConsumoInterno?: boolean
  /** Cuenta corriente: parte del total que queda fiada en vez de cobrada.
   * Requiere customerId. Nunca se suma a ningún MovimientoCaja. */
  fiadoCentavos?: number
  customerId?: string
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

/** Efectivo físico disponible en la sesión abierta de la Caja principal —
 * mismo cálculo que `calcEfectivoEsperado` de cajaSesion.service.ts (solo
 * ventas en efectivo, a diferencia del "total en caja" que usa el equilibrio
 * de Inicio, que sí suma ventas digitales). Es el número que importa acá:
 * cuánta plata física hay para hacer el traspaso a mano. */
async function efectivoDisponibleCajaPrincipal(organizationId: string): Promise<number> {
  const cajaPrincipal = await prisma.caja.findFirst({
    where: { organizationId, esPrincipal: true },
    select: { id: true },
  })
  if (!cajaPrincipal) return 0

  const sesion = await prisma.cajaSesion.findFirst({
    where: { cajaId: cajaPrincipal.id, estado: "ABIERTA" },
    select: {
      fondoInicialCentavos: true,
      movimientos: { select: { tipo: true, montoCentavos: true, medioPago: { select: { esEfectivo: true } } } },
    },
  })
  if (!sesion) return 0

  let total = sesion.fondoInicialCentavos
  for (const m of sesion.movimientos) {
    if (m.tipo === "INGRESO") total += m.montoCentavos
    else if (m.tipo === "EGRESO") total -= m.montoCentavos
    else if (m.tipo === "VENTA" && m.medioPago?.esEfectivo) total += m.montoCentavos
  }
  return total
}

export const ventaService = {
  async crear(input: CrearVentaInput) {
    const ejecutarTx = () =>
      prisma.$transaction(async (tx) => {
      // 0. Replay idempotente: si el cliente ya mandó este id antes (reintento de la
      // cola offline de Flutter tras perder la respuesta), devolvemos la venta ya
      // creada tal cual en vez de reprocesar y duplicar stock/movimientos de caja.
      if (input.id) {
        const existente = await tx.sale.findUnique({
          where: { id: input.id },
          include: {
            lines: { include: { product: true } },
            payments: { include: { paymentMethod: true } },
          },
        })
        if (existente) return existente
      }

      // 1. Cargar productos con categoría (necesaria para resolver cajaId) y el
      // dueño de stock (variantOf) cuando el producto es una variante — ver
      // domain "variantes que comparten stock" (Product.variantOfId).
      const productIds = input.lineas.map((l) => l.productId)
      const productos = await tx.product.findMany({
        where: { id: { in: productIds }, organizationId: input.organizationId, activo: true },
        include: {
          category: { select: { cajaId: true } },
          variantOf: { select: { id: true, stock: true, nombre: true } },
        },
      })

      if (productos.length !== productIds.length) {
        const encontrados = new Set(productos.map((p) => p.id))
        const faltantes = productIds.filter((id) => !encontrados.has(id))
        throw new Error(`Productos no encontrados: ${faltantes.join(", ")}`)
      }

      // 2. Validar stock (gramos para pesables, unidades para el resto —
      // resuelto contra el DUEÑO cuando la línea es una variante). Se acumula
      // el requerido por dueño porque una misma venta puede tener, por
      // ejemplo, docena + media docena del mismo huevo.
      const requeridoPorDueño = new Map<string, { stockDisponible: number; nombre: string; requerido: number }>()
      for (const linea of input.lineas) {
        const producto = productos.find((p) => p.id === linea.productId)!
        if (producto.esPesable) {
          const gramos = linea.gramos ?? 0
          if (gramos <= 0) {
            throw new Error(`Falta indicar el peso de "${producto.nombre}"`)
          }
          const disponible = producto.stockGramos ?? 0
          if (disponible < gramos) {
            throw new Error(
              `Stock insuficiente para "${producto.nombre}": disponible ${disponible}g, requerido ${gramos}g`
            )
          }
          continue
        }

        const stockOwnerId = producto.variantOfId ?? producto.id
        const stockDisponible = producto.variantOfId ? (producto.variantOf?.stock ?? 0) : producto.stock
        const nombreDueño = producto.variantOfId ? (producto.variantOf?.nombre ?? producto.nombre) : producto.nombre
        const requerido = linea.cantidad * producto.unidadesPorVenta

        const acumulado = requeridoPorDueño.get(stockOwnerId)
        requeridoPorDueño.set(stockOwnerId, {
          stockDisponible,
          nombre: nombreDueño,
          requerido: (acumulado?.requerido ?? 0) + requerido,
        })
      }
      for (const info of requeridoPorDueño.values()) {
        if (info.stockDisponible < info.requerido) {
          throw new Error(
            `Stock insuficiente para "${info.nombre}": disponible ${info.stockDisponible}, requerido ${info.requerido}`
          )
        }
      }

      // 2.5. Caja principal (siempre existe)
      const cajaPrincipal = await tx.caja.findFirstOrThrow({
        where: { organizationId: input.organizationId, esPrincipal: true },
        select: { id: true },
      })

      // 3. Construir líneas con costo-foto + totales (money-safe: ver domain/pesables)
      let totalCentavos = 0
      let costoTotalCentavos = 0
      const lineasConFoto = input.lineas.map((linea) => {
        const producto = productos.find((p) => p.id === linea.productId)!
        const precioUnitarioCentavos = precioUnitarioEfectivo(producto)
        const costoUnitarioCentavos = costoUnitarioEfectivo(producto)
        const gramos = producto.esPesable ? linea.gramos ?? 0 : null

        totalCentavos += subtotalLinea({ esPesable: producto.esPesable, precioUnitarioCentavos, cantidad: linea.cantidad, gramos })
        costoTotalCentavos += subtotalLinea({ esPesable: producto.esPesable, precioUnitarioCentavos: costoUnitarioCentavos, cantidad: linea.cantidad, gramos })

        return {
          productId: linea.productId,
          cantidad: producto.esPesable ? 1 : linea.cantidad,
          gramos,
          precioUnitarioCentavos,
          costoUnitarioCentavos,
        }
      })

      // 3.5. Descuento manual del cajero sobre el subtotal de productos — se resta acá y
      // de ahí en más "totalConDescuentoCentavos" es el monto real a cobrar (el recargo
      // virtual y el reparto por caja se calculan sobre este, no sobre el precio de lista).
      const descuentoCentavos = input.descuentoCentavos ?? 0
      if (descuentoCentavos < 0 || descuentoCentavos > totalCentavos) {
        throw new Error("El descuento no puede ser negativo ni mayor al total de la venta")
      }
      const totalConDescuentoCentavos = totalCentavos - descuentoCentavos
      const factorDescuento = totalCentavos > 0 ? totalConDescuentoCentavos / totalCentavos : 1

      // Cuenta corriente: lo que queda fiado NUNCA se atribuye a ninguna caja —
      // solo se reparte entre cajas lo que efectivamente se cobró (ver paso 7).
      // Clamp a 0: si el fiado llegara a superar el total de productos (caso
      // límite con recargo alto), nunca se reparte un monto negativo a una caja.
      const fiadoCentavos = input.fiadoCentavos ?? 0
      const baseAPagarCentavos = Math.max(0, totalConDescuentoCentavos - fiadoCentavos)
      const factorFiado = totalConDescuentoCentavos > 0 ? baseAPagarCentavos / totalConDescuentoCentavos : 1

      // 4. Split por categoría (atribución BASE, antes de overrides por medio de pago)
      const montoPorCajaCategoria = new Map<string, number>()
      for (const linea of input.lineas) {
        const producto = productos.find((p) => p.id === linea.productId)!
        const cajaId = resolverCajaId(producto.category.cajaId, cajaPrincipal.id)
        const precioUnitarioCentavos = precioUnitarioEfectivo(producto)
        const gramos = producto.esPesable ? linea.gramos ?? 0 : null
        const subtotal = subtotalLinea({ esPesable: producto.esPesable, precioUnitarioCentavos, cantidad: linea.cantidad, gramos })
        montoPorCajaCategoria.set(cajaId, (montoPorCajaCategoria.get(cajaId) ?? 0) + subtotal)
      }

      // 5. Medios de pago usados en esta venta (incluye cajaId: override de atribución)
      const medioIds = input.pagos.map((p) => p.paymentMethodId)
      const medios = await tx.paymentMethod.findMany({
        where: { id: { in: medioIds }, organizationId: input.organizationId },
      })
      if (medios.length !== new Set(medioIds).size) {
        throw new Error("Uno o más medios de pago no encontrados")
      }

      const pagosConComision = input.pagos.map((pago) => {
        const medio = medios.find((m) => m.id === pago.paymentMethodId)!
        const { comisionCentavos, montoNetoCentavos } = calcularComision(
          pago.montoCentavos,
          medio.comisionBp
        )
        return {
          paymentMethodId: pago.paymentMethodId,
          montoCentavos: pago.montoCentavos,
          comisionCentavos,
          montoNetoCentavos,
          referencia: pago.referencia,
        }
      })

      // 6. Cajas candidatas: las de categoría + las que algún medio de pago usado tenga como override
      const cajaIdsCategoria = [...montoPorCajaCategoria.keys()]
      const cajaIdsOverride = [...new Set(medios.map((m) => m.cajaId).filter((id): id is string => !!id))]
      const cajasCandidatas = [...new Set([...cajaIdsCategoria, ...cajaIdsOverride])]

      const cajasDetalle = await tx.caja.findMany({
        where: { id: { in: cajasCandidatas }, organizationId: input.organizationId },
        select: { id: true, nombre: true },
      })
      const cajaPorId = new Map(cajasDetalle.map((c) => [c.id, c]))

      // 6.5. Recargo por cigarrillos pagados con QR/Posnet (ver domain/recargo-cigarrillos.ts).
      // Ya no es un % ni un fijo por medio de pago: solo aplica a unidades de la
      // categoría Cigarrillos, escalonado por cantidad (atados vs. sueltos). Se
      // calcula una sola vez para toda la venta y se prorratea por pago más abajo.
      const categoriaCigarrillos = await tx.category.findFirst({
        where: { organizationId: input.organizationId, nombre: "Cigarrillos" },
        select: { id: true },
      })
      const recargoCigarrillosTotalCentavos = categoriaCigarrillos
        ? calcularRecargoCigarrillos(
            input.lineas.map((linea) => {
              const producto = productos.find((p) => p.id === linea.productId)!
              return {
                esCigarrillo: producto.categoryId === categoriaCigarrillos.id,
                esCigarroSuelto: producto.esCigarroSuelto,
                cantidad: linea.cantidad,
              }
            })
          )
        : 0

      // 7. Atribución final por caja: si el medio de pago tiene caja propia, esa porción va
      // entera ahí (override); si no, se reparte proporcional al split por categoría. El recargo
      // de cigarrillos se prorratea por pago (solo QR/Posnet) junto con el ingreso que le
      // corresponde a cada caja.
      const totalPagado = input.pagos.reduce((sum, p) => sum + p.montoCentavos, 0)
      const montoPorCaja = new Map<string, number>()
      const recargoPorCaja = new Map<string, number>()

      for (const pago of input.pagos) {
        const medio = medios.find((m) => m.id === pago.paymentMethodId)!
        const fraccion = totalPagado > 0 ? pago.montoCentavos / totalPagado : 0
        const ingresoPago = Math.round(baseAPagarCentavos * fraccion)
        const recargoPago = medio.esMercadoPago ? Math.round(recargoCigarrillosTotalCentavos * fraccion) : 0

        if (medio.cajaId) {
          montoPorCaja.set(medio.cajaId, (montoPorCaja.get(medio.cajaId) ?? 0) + ingresoPago)
          if (recargoPago > 0) {
            recargoPorCaja.set(medio.cajaId, (recargoPorCaja.get(medio.cajaId) ?? 0) + recargoPago)
          }
        } else {
          for (const [cajaId, montoCategoria] of montoPorCajaCategoria) {
            // La categoría se calculó sobre precio de lista — se escala por el mismo
            // factor del descuento (y, si hay fiado, también por factorFiado) antes de
            // repartir, así la suma entre cajas coincide con la plata realmente
            // cobrada, no con el precio de lista ni con lo que quedó a cuenta corriente.
            const montoCategoriaDescontado = montoCategoria * factorDescuento * factorFiado
            const porcion = Math.round(montoCategoriaDescontado * fraccion)
            montoPorCaja.set(cajaId, (montoPorCaja.get(cajaId) ?? 0) + porcion)
            if (recargoPago > 0 && totalConDescuentoCentavos > 0) {
              const recargoPorcion = Math.round((recargoPago * montoCategoriaDescontado) / totalConDescuentoCentavos)
              recargoPorCaja.set(cajaId, (recargoPorCaja.get(cajaId) ?? 0) + recargoPorcion)
            }
          }
        }
      }

      const recargoCentavosTotal = [...recargoPorCaja.values()].reduce((sum, r) => sum + r, 0)

      // 7.5. Validar sesión abierta para cada caja que efectivamente recibe plata
      const cajasInvolucradas = [...montoPorCaja.keys()]
      const sesionesAbiertas = await tx.cajaSesion.findMany({
        where: { cajaId: { in: cajasInvolucradas }, estado: "ABIERTA", organizationId: input.organizationId },
        select: { id: true, cajaId: true },
      })
      const sesionPorCaja = new Map(sesionesAbiertas.map((s) => [s.cajaId, s.id]))

      for (const cajaId of cajasInvolucradas) {
        if (!sesionPorCaja.has(cajaId)) {
          const caja = cajaPorId.get(cajaId)
          throw new Error(`Abrí la ${caja?.nombre ?? "caja"} antes de confirmar la venta`)
        }
      }

      // 8. Validar pago suficiente (productos con descuento + recargo virtual),
      // salvo el resto que se deja fiado a un cliente (cuenta corriente).
      if (fiadoCentavos > 0 && !input.customerId) {
        throw new Error("Elegí un cliente para dejar el resto a cuenta corriente")
      }
      if (totalPagado + fiadoCentavos < totalConDescuentoCentavos + recargoCentavosTotal) {
        throw new Error(
          `Pago insuficiente: total a cobrar $${(totalConDescuentoCentavos + recargoCentavosTotal) / 100}, pagado $${totalPagado / 100}`
        )
      }
      if (fiadoCentavos > 0) {
        await tx.customer.findFirstOrThrow({ where: { id: input.customerId, organizationId: input.organizationId } })
      }

      // 9. Crear venta con líneas y pagos
      const venta = await tx.sale.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          userId: input.userId,
          organizationId: input.organizationId,
          totalCentavos: totalConDescuentoCentavos,
          costoTotalCentavos,
          recargoCentavos: recargoCentavosTotal,
          descuentoCentavos,
          esConsumoInterno: input.esConsumoInterno ?? false,
          fiadoCentavos,
          customerId: fiadoCentavos > 0 ? input.customerId : undefined,
          lines: { create: lineasConFoto },
          payments: { create: pagosConComision },
        },
        include: {
          lines: { include: { product: true } },
          payments: { include: { paymentMethod: true } },
        },
      })

      // 9.5. Cuenta corriente: el resto fiado sube lo que nos debe el cliente.
      // Nunca toca ningún MovimientoCaja — es plata que no entró todavía.
      if (fiadoCentavos > 0 && input.customerId) {
        await tx.customer.update({
          where: { id: input.customerId },
          data: { saldoCuentaCorrienteCentavos: { increment: fiadoCentavos } },
        })
      }

      // 10. Descontar stock y crear movimientos (gramos para pesables, unidades para el resto).
      // Decremento atómico condicional (`decrement` + guard `gte` en el where) en vez de restar
      // sobre el valor leído en el paso 2 — dos ventas concurrentes del mismo producto podían
      // leer el mismo stock y la segunda pisaba el resultado de la primera (oversell). El chequeo
      // del paso 2 queda como mensaje de error temprano; este `updateMany` es la validación real.
      for (const linea of input.lineas) {
        const producto = productos.find((p) => p.id === linea.productId)!

        if (producto.esPesable) {
          const gramos = linea.gramos ?? 0
          const { count } = await tx.product.updateMany({
            where: { id: linea.productId, stockGramos: { gte: gramos } },
            data: { stockGramos: { decrement: gramos } },
          })
          if (count === 0) {
            throw new Error(`Stock insuficiente para "${producto.nombre}"`)
          }
          const actualizado = await tx.product.findUniqueOrThrow({
            where: { id: linea.productId },
            select: { stockGramos: true },
          })
          const gramosPosterior = actualizado.stockGramos ?? 0
          const gramosAnterior = gramosPosterior + gramos

          await tx.stockMovement.create({
            data: {
              productId: linea.productId,
              userId: input.userId,
              tipo: "SALIDA",
              cantidad: 0,
              stockAnterior: 0,
              stockPosterior: 0,
              gramos,
              gramosAnterior,
              gramosPosterior,
              saleId: venta.id,
              motivo: "Venta",
            },
          })
        } else {
          // Variante → el stock se descuenta del DUEÑO, no de esta fila (su
          // `stock` propio se ignora). `requerido` son unidades base del
          // dueño (cantidad × unidadesPorVenta), ver paso 2.
          const stockOwnerId = producto.variantOfId ?? producto.id
          const requerido = linea.cantidad * producto.unidadesPorVenta
          const nombreDueño = producto.variantOfId ? (producto.variantOf?.nombre ?? producto.nombre) : producto.nombre

          const { count } = await tx.product.updateMany({
            where: { id: stockOwnerId, stock: { gte: requerido } },
            data: { stock: { decrement: requerido } },
          })
          if (count === 0) {
            throw new Error(`Stock insuficiente para "${nombreDueño}"`)
          }
          const actualizado = await tx.product.findUniqueOrThrow({
            where: { id: stockOwnerId },
            select: { stock: true },
          })
          const stockPosterior = actualizado.stock
          const stockAnterior = stockPosterior + requerido

          await tx.stockMovement.create({
            data: {
              productId: stockOwnerId,
              userId: input.userId,
              tipo: "SALIDA",
              cantidad: requerido,
              stockAnterior,
              stockPosterior,
              saleId: venta.id,
              motivo: "Venta",
            },
          })
        }
      }

      // 10.5. Fondo de reposición por proveedor: el 100% del costo de cada línea (escalado por
      // el mismo factorDescuento que ya reparte la plata real cobrada entre cajas) se acumula
      // siempre para reponer stock; si el proveedor tiene algún producto en stock bajo tras esta
      // venta, se suma además el 60% de la ganancia de línea (también escalada) — así se prioriza
      // reponer productos que se están por agotar aunque implique reinvertir parte de la ganancia.
      // No aplica a consumo interno: no entró plata real que financie la reposición.
      const providerIdsInvolucrados = input.esConsumoInterno
        ? []
        : [...new Set(productos.map((p) => p.providerId).filter((id): id is string => !!id))]

      if (providerIdsInvolucrados.length > 0) {
        // Excluye variantes: su `stock` propio se ignora (siempre figuraría en
        // 0 y falsearía el escaneo) — solo los dueños tienen stock real.
        const productosDeProveedores = await tx.product.findMany({
          where: { providerId: { in: providerIdsInvolucrados }, organizationId: input.organizationId, activo: true, variantOfId: null },
          select: { providerId: true, esPesable: true, stock: true, stockMinimo: true, stockGramos: true, stockMinimoGramos: true },
        })
        const proveedoresConStockBajo = new Set(
          productosDeProveedores
            .filter((p) =>
              p.esPesable ? (p.stockGramos ?? 0) <= (p.stockMinimoGramos ?? 0) : p.stock <= p.stockMinimo
            )
            .map((p) => p.providerId!)
        )

        const aportePorProveedor = new Map<string, number>()
        for (const linea of lineasConFoto) {
          const producto = productos.find((p) => p.id === linea.productId)!
          if (!producto.providerId) continue

          const costoLinea = subtotalLinea({
            esPesable: producto.esPesable,
            precioUnitarioCentavos: linea.costoUnitarioCentavos,
            cantidad: linea.cantidad,
            gramos: linea.gramos,
          })
          const precioLinea = subtotalLinea({
            esPesable: producto.esPesable,
            precioUnitarioCentavos: linea.precioUnitarioCentavos,
            cantidad: linea.cantidad,
            gramos: linea.gramos,
          })
          const costoLineaCobrado = Math.round(costoLinea * factorDescuento)
          const precioLineaCobrado = Math.round(precioLinea * factorDescuento)
          const gananciaLineaCobrada = precioLineaCobrado - costoLineaCobrado

          let aporte = costoLineaCobrado
          if (proveedoresConStockBajo.has(producto.providerId)) {
            aporte += Math.round(gananciaLineaCobrada * 0.6)
          }

          aportePorProveedor.set(
            producto.providerId,
            (aportePorProveedor.get(producto.providerId) ?? 0) + aporte
          )
        }

        for (const [providerId, montoCentavos] of aportePorProveedor) {
          if (montoCentavos === 0) continue
          await tx.provider.update({
            where: { id: providerId },
            data: { saldoReposicionCentavos: { increment: montoCentavos } },
          })
        }
      }

      // 11. Atribuir venta a cajas (un MovimientoCaja por caja involucrada) — con
      // una venta 100% fiada (sin pagos reales) input.pagos puede venir vacío;
      // montoPorCaja también queda vacío en ese caso, así que este loop no llega
      // a usar medioPagoId, pero igual evitamos el crash al calcularlo.
      const medioPagoId = input.pagos[0]?.paymentMethodId
      for (const [cajaId, montoCentavos] of montoPorCaja) {
        const cajaSesionId = sesionPorCaja.get(cajaId)!
        const recargoCentavos = recargoPorCaja.get(cajaId) ?? 0

        await tx.movimientoCaja.create({
          data: {
            cajaSesionId,
            cajaId,
            saleId: venta.id,
            tipo: "VENTA",
            montoCentavos,
            recargoCentavos,
            medioPagoId,
            organizationId: input.organizationId,
          },
        })
      }

      // 11.5. Traspaso de cigarrillos por QR/Posnet: el proveedor de cigarrillos
      // solo acepta efectivo. La venta por un medio no-efectivo (QR/Posnet) ya
      // va entera a la caja que tenga configurada ese medio (ver paso 7) y no
      // deja nada de efectivo en Caja Cigarrillos — así que hace falta un
      // traspaso real de billetes desde Caja general. Ese traspaso lo hace una
      // persona a mano, así que acá SOLO se calcula y guarda el monto — el
      // movimiento de caja (EGRESO + INGRESO) recién se crea cuando alguien
      // confirma que ya lo hizo físicamente (ver confirmarTraspasoCigarrillos).
      let traspasoCigarrillosCentavos = 0
      if (categoriaCigarrillos) {
        let montoCigarrillosLista = 0
        for (const linea of input.lineas) {
          const producto = productos.find((p) => p.id === linea.productId)!
          if (producto.categoryId !== categoriaCigarrillos.id) continue
          const precioUnitarioCentavos = precioUnitarioEfectivo(producto)
          const gramos = producto.esPesable ? linea.gramos ?? 0 : null
          montoCigarrillosLista += subtotalLinea({ esPesable: producto.esPesable, precioUnitarioCentavos, cantidad: linea.cantidad, gramos })
        }
        const montoCigarrillosDescontado = Math.round(montoCigarrillosLista * factorDescuento)

        if (montoCigarrillosDescontado > 0 || recargoCigarrillosTotalCentavos > 0) {
          for (const pago of input.pagos) {
            const medio = medios.find((m) => m.id === pago.paymentMethodId)!
            if (medio.esEfectivo) continue

            const fraccion = totalPagado > 0 ? pago.montoCentavos / totalPagado : 0
            const montoBase = Math.round(montoCigarrillosDescontado * fraccion)
            // El recargo ya es 100% cigarrillos (ver paso 6.5) — a diferencia de antes,
            // no hace falta volver a prorratearlo por el peso de los cigarrillos dentro
            // de la venta: la porción de este pago YA es el recargo que le corresponde.
            const recargoBase = medio.esMercadoPago ? Math.round(recargoCigarrillosTotalCentavos * fraccion) : 0

            traspasoCigarrillosCentavos += montoBase + recargoBase
          }
        }
      }

      if (traspasoCigarrillosCentavos > 0) {
        await tx.sale.update({
          where: { id: venta.id },
          data: { traspasoCigarrillosCentavos },
        })
        // El objeto ya creado en el paso 9 quedaría desactualizado (traspasoCigarrillosCentavos: 0)
        // si no se refleja acá — nada lo consume hoy, pero que el valor devuelto sea real.
        venta.traspasoCigarrillosCentavos = traspasoCigarrillosCentavos
      }

      return venta
      })

    // El check idempotente del paso 0 cubre el reintento secuencial (el más
    // común en la cola offline). Pero dos reintentos del mismo `id` en vuelo a
    // la vez pueden pasar ambos ese check y chocar recién en el INSERT: el que
    // pierde recibe una violación de unicidad de la PK. En vez de propagar ese
    // error crudo, tratamos la carrera como lo que es —una venta ya creada— y
    // devolvemos la existente (idempotencia real, sin duplicar stock ni caja).
    let venta: Awaited<ReturnType<typeof ejecutarTx>>
    try {
      venta = await ejecutarTx()
    } catch (error) {
      if (
        input.id &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existente = await prisma.sale.findUnique({
          where: { id: input.id },
          include: {
            lines: { include: { product: true } },
            payments: { include: { paymentMethod: true } },
          },
        })
        if (!existente) throw error
        venta = existente
      } else {
        throw error
      }
    }

    // Facturación AFIP — fuera de la transacción (es una llamada de red, no debe
    // tener el lock de la venta abierto mientras espera) y en segundo plano: si
    // AFIP falla o está caído, la venta ya quedó confirmada igual y el
    // comprobante queda en ERROR para reintentar después (ver
    // facturacionService, historial de ventas). Consumo interno no factura:
    // no es una venta real a un cliente.
    // Si la venta dispara facturación, esperamos el CAE antes de imprimir —
    // así el tiquet del posnet sale con los datos fiscales completos en un
    // solo papel, en vez de un segundo tiquet aparte. Ninguna de las dos
    // etapas debe bloquear la venta ya confirmada ni abortar por un error.
    const disparaFacturacion =
      !venta.esConsumoInterno && venta.payments.some((p) => p.paymentMethod.facturarAutomaticamente)
    ;(async () => {
      if (disparaFacturacion) {
        await facturacionService
          .facturarVenta(venta.id, input.organizationId)
          .catch((error) => logError("venta.facturarVenta", error, { saleId: venta.id }))
      }
      await impresionService
        .imprimirTicketVenta(venta.id, input.organizationId)
        .catch((error) => logError("venta.imprimirTicket", error, { saleId: venta.id }))
    })()

    return venta
  },

  /**
   * Confirma que el traspaso físico de efectivo (Caja general → Caja
   * Cigarrillos) ya se hizo, y recién ahí crea el movimiento de caja
   * correspondiente. Idempotente: si ya estaba confirmado, no hace nada.
   */
  async confirmarTraspasoCigarrillos(saleId: string, organizationId: string) {
    return prisma.$transaction(async (tx) => {
      const venta = await tx.sale.findFirstOrThrow({ where: { id: saleId, organizationId } })
      if (venta.traspasoCigarrillosCentavos === 0 || venta.traspasoCigarrillosConfirmado) {
        return venta
      }

      const cajaPrincipal = await tx.caja.findFirstOrThrow({
        where: { organizationId, esPrincipal: true },
        select: { id: true, nombre: true },
      })
      const categoriaCigarrillos = await tx.category.findFirstOrThrow({
        where: { organizationId, nombre: "Cigarrillos" },
        select: { cajaId: true },
      })
      const cajaCigarrillosId = resolverCajaId(categoriaCigarrillos.cajaId, cajaPrincipal.id)
      const cajaCigarrillos = await tx.caja.findFirstOrThrow({
        where: { id: cajaCigarrillosId, organizationId },
        select: { id: true, nombre: true },
      })

      const [sesionPrincipal, sesionCigarrillos] = await Promise.all([
        tx.cajaSesion.findFirst({ where: { cajaId: cajaPrincipal.id, estado: "ABIERTA" } }),
        tx.cajaSesion.findFirst({ where: { cajaId: cajaCigarrillos.id, estado: "ABIERTA" } }),
      ])
      if (!sesionPrincipal) throw new Error(`Abrí la ${cajaPrincipal.nombre} antes de confirmar el traspaso`)
      if (!sesionCigarrillos) throw new Error(`Abrí la ${cajaCigarrillos.nombre} antes de confirmar el traspaso`)

      const nota = "Traspaso cigarrillos QR/Posnet"
      await tx.movimientoCaja.create({
        data: {
          cajaSesionId: sesionPrincipal.id,
          cajaId: cajaPrincipal.id,
          saleId: venta.id,
          tipo: "EGRESO",
          montoCentavos: venta.traspasoCigarrillosCentavos,
          nota,
          organizationId,
        },
      })
      await tx.movimientoCaja.create({
        data: {
          cajaSesionId: sesionCigarrillos.id,
          cajaId: cajaCigarrillos.id,
          saleId: venta.id,
          tipo: "INGRESO",
          montoCentavos: venta.traspasoCigarrillosCentavos,
          nota,
          organizationId,
        },
      })

      return tx.sale.update({
        where: { id: venta.id },
        data: { traspasoCigarrillosConfirmado: true },
      })
    })
  },

  /**
   * Traspasos de cigarrillos sin confirmar, más si hay efectivo físico
   * suficiente en la Caja principal para hacerlos AHORA. Si no lo hay, el
   * gate no debe bloquear la pantalla — no tiene sentido forzar a alguien a
   * mentir que ya hizo un traspaso que no puede hacer porque no hay billetes.
   * En cuanto entre efectivo suficiente (venta en efectivo o ingreso manual),
   * `bloqueante` pasa a true solo (el polling del gate se encarga del resto).
   */
  async listarTraspasosPendientes(organizationId: string) {
    const pendientes = await prisma.sale.findMany({
      where: { organizationId, traspasoCigarrillosCentavos: { gt: 0 }, traspasoCigarrillosConfirmado: false },
      select: { id: true, fecha: true, traspasoCigarrillosCentavos: true },
      orderBy: { fecha: "asc" },
    })
    if (pendientes.length === 0) return { pendientes, totalCentavos: 0, bloqueante: false }

    const totalCentavos = pendientes.reduce((sum, p) => sum + p.traspasoCigarrillosCentavos, 0)
    const efectivoDisponible = await efectivoDisponibleCajaPrincipal(organizationId)
    return { pendientes, totalCentavos, bloqueante: efectivoDisponible >= totalCentavos }
  },

  async obtener(id: string, organizationId: string) {
    return prisma.sale.findFirst({
      where: { id, organizationId },
      include: {
        lines: { include: { product: { include: { category: true, provider: true } } } },
        payments: { include: { paymentMethod: true } },
        user: { select: { id: true, nombre: true, email: true } },
        customer: { select: { id: true, nombre: true } },
        comprobante: true,
        organization: { select: { cuit: true, nombre: true } },
      },
    })
  },

  async listar(organizationId: string, opts?: { fechaDesde?: Date; fechaHasta?: Date; limit?: number }) {
    return prisma.sale.findMany({
      where: {
        organizationId,
        ...(opts?.fechaDesde || opts?.fechaHasta
          ? {
              fecha: {
                ...(opts.fechaDesde && { gte: opts.fechaDesde }),
                ...(opts.fechaHasta && { lte: opts.fechaHasta }),
              },
            }
          : {}),
      },
      select: {
        id: true,
        fecha: true,
        totalCentavos: true,
        costoTotalCentavos: true,
        descuentoCentavos: true,
        esConsumoInterno: true,
        _count: { select: { lines: true } },
        payments: { select: { paymentMethod: { select: { nombre: true } } } },
        user: { select: { nombre: true } },
      },
      orderBy: { fecha: "desc" },
      take: opts?.limit ?? 100,
    })
  },

  /**
   * Historial paginado para la pantalla de revisión — a diferencia de `listar`
   * (usado por la exportación CSV), trae los `_count` de pagos/movimientos de
   * caja/stock necesarios para detectar ventas "fantasma" (cargadas sin pasar
   * por `crear`, ej. a mano en la base) o con plata que nunca llegó a una caja.
   */
  async listarPaginado(
    organizationId: string,
    opts: {
      fechaDesde?: Date; fechaHasta?: Date; medioPagoId?: string
      facturaEstado?: "EMITIDO" | "ERROR" | "SIN_FACTURAR"
      page: number; pageSize: number
    }
  ) {
    const where = {
      organizationId,
      ...(opts.fechaDesde || opts.fechaHasta
        ? {
            fecha: {
              ...(opts.fechaDesde && { gte: opts.fechaDesde }),
              ...(opts.fechaHasta && { lte: opts.fechaHasta }),
            },
          }
        : {}),
      ...(opts.medioPagoId ? { payments: { some: { paymentMethodId: opts.medioPagoId } } } : {}),
      ...(opts.facturaEstado === "SIN_FACTURAR"
        ? { comprobante: null }
        : opts.facturaEstado
          ? { comprobante: { estado: opts.facturaEstado } }
          : {}),
    }

    const [ventas, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        select: {
          id: true,
          fecha: true,
          totalCentavos: true,
          costoTotalCentavos: true,
          descuentoCentavos: true,
          recargoCentavos: true,
          fiadoCentavos: true,
          esConsumoInterno: true,
          customer: { select: { nombre: true } },
          user: { select: { nombre: true, email: true } },
          payments: { select: { montoCentavos: true, paymentMethod: { select: { nombre: true } } } },
          comprobante: { select: { estado: true, tipo: true, numero: true } },
          _count: { select: { lines: true, payments: true, movimientosCaja: true, stockMovements: true } },
        },
        orderBy: { fecha: "desc" },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
      prisma.sale.count({ where }),
    ])

    return { ventas, total }
  },
}
