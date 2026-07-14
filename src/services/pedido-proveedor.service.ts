import { prisma } from "@/lib/prisma"
import { productoService } from "@/services/producto.service"
import { stockService } from "@/services/stock.service"
import { proveedorService } from "@/services/config.service"
import { precioDesdeCosoYMarkup, markupBpDesdeCostoYPrecio } from "@/domain/markup"
import { redondearPesoArriba } from "@/domain/dinero"

// Pesables (fiambre, etc.) no están soportados todavía en esta pantalla — el
// "monto puntual del bulto" no tiene un análogo simple en kg, se deja para
// cuando haga falta.

export interface LineaPedidoInput {
  productId: string
  cantidad: number
  /** Lo que se pagó por esta línea completa (ej. 6 unidades por $9.000), sin
   * impuestos — de acá sale el costo unitario base. */
  montoTotalCentavos: number
  /** Si no se manda, se recalcula manteniendo el markup actual del producto. */
  precioVentaCentavos?: number
}

export interface IngresarPedidoInput {
  organizationId: string
  userId: string
  providerId: string
  lineas: LineaPedidoInput[]
  /** Impuestos cargados como monto fijo (el negocio es monotributista: no hay
   * crédito fiscal, todo pasa a formar parte del costo) — se prorratean entre
   * las líneas según su monto base. */
  ivaCentavos?: number
  otrosImpuestosCentavos?: number
  /** Cuánto de este pedido se paga ahora (0 = todo a cuenta corriente). */
  montoPagadoCentavos: number
  /** Requerido si montoPagadoCentavos > 0 — debe tener sesión abierta. */
  cajaId?: string
}

export const pedidoProveedorService = {
  async ingresar(input: IngresarPedidoInput) {
    if (input.lineas.length === 0) throw new Error("El pedido no tiene líneas")
    if (input.montoPagadoCentavos > 0 && !input.cajaId) {
      throw new Error("Elegí una caja para registrar el pago")
    }

    const provider = await prisma.provider.findFirstOrThrow({
      where: { id: input.providerId, organizationId: input.organizationId },
    })

    const productos = await prisma.product.findMany({
      where: { id: { in: input.lineas.map((l) => l.productId) }, organizationId: input.organizationId },
    })
    const productoPorId = new Map(productos.map((p) => [p.id, p]))
    for (const linea of input.lineas) {
      const producto = productoPorId.get(linea.productId)
      if (!producto) throw new Error(`Producto ${linea.productId} no encontrado`)
      if (producto.esPesable) throw new Error(`${producto.nombre} es pesable — no soportado en esta pantalla todavía`)
    }

    const subtotalCentavos = input.lineas.reduce((sum, l) => sum + l.montoTotalCentavos, 0)
    const impuestosTotalesCentavos = (input.ivaCentavos ?? 0) + (input.otrosImpuestosCentavos ?? 0)

    for (const linea of input.lineas) {
      const producto = productoPorId.get(linea.productId)!
      const fraccion = subtotalCentavos > 0 ? linea.montoTotalCentavos / subtotalCentavos : 0
      const impuestosLinea = Math.round(impuestosTotalesCentavos * fraccion)
      const costoLineaConImpuestos = linea.montoTotalCentavos + impuestosLinea
      // El negocio no maneja centavos: el costo real por unidad se redondea para
      // arriba al peso entero (ver domain/dinero.ts).
      const costoUnitarioFinal = redondearPesoArriba(Math.round(costoLineaConImpuestos / linea.cantidad))

      const markupActualBp = producto.costoCentavos > 0
        ? markupBpDesdeCostoYPrecio(producto.costoCentavos, producto.precioCentavos)
        : 0
      const precioVentaFinal = linea.precioVentaCentavos !== undefined
        ? redondearPesoArriba(linea.precioVentaCentavos)
        : precioDesdeCosoYMarkup(costoUnitarioFinal, markupActualBp)

      await productoService.actualizarCostoYPrecio(linea.productId, input.organizationId, {
        costoCentavos: costoUnitarioFinal,
        precioCentavos: precioVentaFinal,
      })

      // Se registra DESPUÉS de actualizar el costo: la entrada descuenta del
      // fondo de reposición usando el costo recién cargado (el real de esta
      // compra), no el viejo/provisional.
      await stockService.registrarMovimiento({
        productId: linea.productId,
        userId: input.userId,
        organizationId: input.organizationId,
        tipo: "ENTRADA",
        cantidad: linea.cantidad,
        motivo: `Pedido a ${provider.nombre}`,
      })
    }

    const totalPedidoCentavos = subtotalCentavos + impuestosTotalesCentavos
    await proveedorService.registrarCompraCuentaCorriente(input.providerId, input.organizationId, totalPedidoCentavos)
    if (input.montoPagadoCentavos > 0) {
      await proveedorService.registrarPagoCuentaCorriente(
        input.providerId,
        input.organizationId,
        input.montoPagadoCentavos,
        input.cajaId!
      )
    }

    return { totalPedidoCentavos }
  },
}
