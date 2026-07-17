import { prisma } from "@/lib/prisma"
import { prisma as prismaAuth } from "@/lib/prisma-auth"
import { mesAnioActual, inicioMes, finMes } from "@/domain/dinero"
import { calcularTrialTerminaEl } from "@/lib/suscripcion"
import { precioDesdeCosoYMarkup, precioDesdeCosoYGananciaFija, markupBpDesdeCostoYPrecio } from "@/domain/markup"
import bcrypt from "bcryptjs"

// ─── Categorías ──────────────────────────────────────────────────────────────

export const categoriaService = {
  async listar(organizationId: string) {
    return prisma.category.findMany({
      where: { organizationId },
      include: { _count: { select: { products: true } } },
      orderBy: { nombre: "asc" },
    })
  },

  async crear(organizationId: string, data: {
    nombre: string
    markupDefaultBp: number
    markupDefaultTipo?: "PORCENTUAL" | "FIJO"
    markupDefaultFijoCentavos?: number
  }) {
    return prisma.category.create({ data: { ...data, organizationId } })
  },

  async editar(id: string, organizationId: string, data: {
    nombre?: string
    markupDefaultBp?: number
    markupDefaultTipo?: "PORCENTUAL" | "FIJO"
    markupDefaultFijoCentavos?: number
  }) {
    await prisma.category.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.category.update({ where: { id }, data })
  },

  async desactivar(id: string, organizationId: string) {
    await prisma.category.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.category.update({ where: { id }, data: { activo: false } })
  },

  async reactivar(id: string, organizationId: string) {
    await prisma.category.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.category.update({ where: { id }, data: { activo: true } })
  },

  async eliminar(id: string, organizationId: string) {
    const cat = await prisma.category.findFirstOrThrow({ where: { id, organizationId } })
    const productos = await prisma.product.count({ where: { categoryId: id } })
    if (productos > 0) throw new Error(`No se puede eliminar: tiene ${productos} producto(s) asociado(s)`)
    return prisma.category.delete({ where: { id: cat.id } })
  },

  /** Vista previa de "Recalcular precios": qué productos activos de esta
   * categoría cambiarían de precio si se les aplicara el markup default
   * ACTUAL de la categoría sobre su costo actual (sin tocar el costo). No hay
   * forma de distinguir en el modelo un producto con markup "manual" de uno
   * que coincide con el default por casualidad, así que se listan todos los
   * que cambiarían y el dueño elige cuáles aplicar en aplicarRecalculo. */
  async previsualizarRecalculo(id: string, organizationId: string) {
    const categoria = await prisma.category.findFirstOrThrow({ where: { id, organizationId } })
    const productos = await prisma.product.findMany({
      where: { categoryId: id, organizationId, activo: true },
      select: {
        id: true, nombre: true, esPesable: true,
        costoCentavos: true, precioCentavos: true,
        costoPorKgCentavos: true, precioPorKgCentavos: true,
      },
    })
    return productos
      .map((p) => {
        const costo = p.esPesable ? (p.costoPorKgCentavos ?? 0) : p.costoCentavos
        const precioActual = p.esPesable ? (p.precioPorKgCentavos ?? 0) : p.precioCentavos
        if (costo <= 0) return null
        const precioNuevo =
          categoria.markupDefaultTipo === "FIJO"
            ? precioDesdeCosoYGananciaFija(costo, categoria.markupDefaultFijoCentavos)
            : precioDesdeCosoYMarkup(costo, categoria.markupDefaultBp)
        if (precioNuevo === precioActual) return null
        return { id: p.id, nombre: p.nombre, esPesable: p.esPesable, costoCentavos: costo, precioActualCentavos: precioActual, precioNuevoCentavos: precioNuevo }
      })
      .filter((x) => x !== null)
  },

  /** Aplica el recálculo solo a los productos elegidos en la vista previa —
   * nunca a toda la categoría a ciegas. Recalcula contra el markup default
   * VIGENTE al momento de aplicar (no el de cuando se pidió la vista previa),
   * por si alguien la dejó abierta y mientras tanto cambió el default de nuevo. */
  async aplicarRecalculo(id: string, organizationId: string, productIds: string[]) {
    const categoria = await prisma.category.findFirstOrThrow({ where: { id, organizationId } })
    const productos = await prisma.product.findMany({
      where: { id: { in: productIds }, categoryId: id, organizationId, activo: true },
    })
    await prisma.$transaction(
      productos.flatMap((p) => {
        const costo = p.esPesable ? (p.costoPorKgCentavos ?? 0) : p.costoCentavos
        if (costo <= 0) return []
        const precioNuevo =
          categoria.markupDefaultTipo === "FIJO"
            ? precioDesdeCosoYGananciaFija(costo, categoria.markupDefaultFijoCentavos)
            : precioDesdeCosoYMarkup(costo, categoria.markupDefaultBp)
        return [
          prisma.product.update({
            where: { id: p.id },
            data: p.esPesable ? { precioPorKgCentavos: precioNuevo } : { precioCentavos: precioNuevo },
          }),
        ]
      })
    )
    return { actualizados: productos.length }
  },
}

// ─── Proveedores ─────────────────────────────────────────────────────────────

export const proveedorService = {
  async listar(organizationId: string) {
    return prisma.provider.findMany({
      where: { organizationId },
      include: { _count: { select: { products: true } } },
      orderBy: { nombre: "asc" },
    })
  },

  async crear(organizationId: string, data: { nombre: string }) {
    return prisma.provider.create({ data: { ...data, organizationId } })
  },

  async editar(id: string, organizationId: string, data: { nombre: string }) {
    await prisma.provider.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.provider.update({ where: { id }, data })
  },

  async desactivar(id: string, organizationId: string) {
    await prisma.provider.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.provider.update({ where: { id }, data: { activo: false } })
  },

  async reactivar(id: string, organizationId: string) {
    await prisma.provider.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.provider.update({ where: { id }, data: { activo: true } })
  },

  async eliminar(id: string, organizationId: string) {
    await prisma.provider.findFirstOrThrow({ where: { id, organizationId } })
    const productos = await prisma.product.count({ where: { providerId: id } })
    if (productos > 0) throw new Error(`No se puede eliminar: tiene ${productos} producto(s) asociado(s)`)
    return prisma.provider.delete({ where: { id } })
  },

  /** Piso de reinversión: colchón fijo en pesos que se reserva para este
   * proveedor antes de considerar "ganancia limpia" disponible — ver
   * resumenService.reparto. Se carga a mano, no se resetea. */
  async actualizarPisoReposicion(id: string, organizationId: string, montoCentavos: number) {
    await prisma.provider.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.provider.update({ where: { id }, data: { pisoReposicionCentavos: montoCentavos } })
  },

  /** Cuenta corriente: compra a crédito — sube lo que le debemos, cargado a mano
   * o disparado desde pedidoProveedorService.ingresar. Deja fila en el ledger. */
  async registrarCompraCuentaCorriente(id: string, organizationId: string, montoCentavos: number) {
    return prisma.$transaction(async (tx) => {
      await tx.provider.findFirstOrThrow({ where: { id, organizationId } })
      await tx.movimientoCuentaCorrienteProveedor.create({
        data: { providerId: id, organizationId, tipo: "COMPRA", montoCentavos },
      })
      return tx.provider.update({
        where: { id },
        data: { saldoCuentaCorrienteCentavos: { increment: montoCentavos } },
      })
    })
  },

  /** Cuenta corriente: pago al proveedor — baja lo que le debemos Y crea un
   * EGRESO real en la caja elegida (plata que efectivamente salió). Deja fila
   * en el ledger, igual que la compra. */
  async registrarPagoCuentaCorriente(
    id: string,
    organizationId: string,
    montoCentavos: number,
    cajaId: string
  ) {
    return prisma.$transaction(async (tx) => {
      const provider = await tx.provider.findFirstOrThrow({ where: { id, organizationId } })
      const caja = await tx.caja.findFirstOrThrow({ where: { id: cajaId, organizationId } })
      const sesion = await tx.cajaSesion.findFirst({ where: { cajaId, estado: "ABIERTA" } })
      if (!sesion) throw new Error(`Abrí la ${caja.nombre} antes de registrar el pago`)

      await tx.movimientoCaja.create({
        data: {
          cajaSesionId: sesion.id,
          cajaId,
          tipo: "EGRESO",
          montoCentavos,
          nota: `Pago a proveedor: ${provider.nombre}`,
          organizationId,
        },
      })

      await tx.movimientoCuentaCorrienteProveedor.create({
        data: { providerId: id, organizationId, tipo: "PAGO", montoCentavos, cajaId },
      })

      // Nunca por debajo de $0: si no había cuenta corriente (o el pago supera
      // la deuda), esto es simplemente un pago de un pedido — el EGRESO de
      // arriba ya lo registra. La cuenta corriente no es "saldo a favor" ni
      // va en negativo, solo refleja deuda real pendiente.
      return tx.provider.update({
        where: { id },
        data: { saldoCuentaCorrienteCentavos: Math.max(0, provider.saldoCuentaCorrienteCentavos - montoCentavos) },
      })
    })
  },

  /** Historial de compras/pagos de este proveedor — ver MovimientoCuentaCorrienteProveedor. */
  async listarMovimientosCuentaCorriente(id: string, organizationId: string) {
    await prisma.provider.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.movimientoCuentaCorrienteProveedor.findMany({
      where: { providerId: id, organizationId },
      include: { caja: { select: { nombre: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
  },

  /** Historial de pedidos (entradas de stock) a este proveedor — no hay un
   * modelo de "pedido" propio, cada línea de pedidoProveedorService.ingresar
   * queda como una ENTRADA de StockMovement con motivo "Pedido a {nombre}". */
  async listarPedidos(id: string, organizationId: string) {
    const provider = await prisma.provider.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.stockMovement.findMany({
      where: {
        tipo: "ENTRADA",
        motivo: `Pedido a ${provider.nombre}`,
        product: { organizationId },
      },
      include: { product: { select: { nombre: true, sku: true } } },
      orderBy: { creadoEn: "desc" },
      take: 200,
    })
  },

  /** Vista previa de "Subió todo un X%": nuevo costo de cada producto activo
   * de este proveedor, manteniendo el markup actual de cada uno (el precio
   * de venta se recalcula solo a partir del costo nuevo). No toca nada
   * todavía — ver aplicarAjusteCosto. */
  async previsualizarAjusteCosto(id: string, organizationId: string, porcentaje: number) {
    await prisma.provider.findFirstOrThrow({ where: { id, organizationId } })
    const productos = await prisma.product.findMany({
      where: { providerId: id, organizationId, activo: true },
      select: {
        id: true, nombre: true, esPesable: true,
        costoCentavos: true, precioCentavos: true,
        costoPorKgCentavos: true, precioPorKgCentavos: true,
      },
    })
    return productos
      .map((p) => {
        const costo = p.esPesable ? (p.costoPorKgCentavos ?? 0) : p.costoCentavos
        const precio = p.esPesable ? (p.precioPorKgCentavos ?? 0) : p.precioCentavos
        if (costo <= 0) return null
        const costoNuevo = Math.round(costo * (1 + porcentaje / 100))
        const markupActual = markupBpDesdeCostoYPrecio(costo, precio)
        const precioNuevo = precioDesdeCosoYMarkup(costoNuevo, markupActual)
        return { id: p.id, nombre: p.nombre, esPesable: p.esPesable, costoActualCentavos: costo, costoNuevoCentavos: costoNuevo, precioActualCentavos: precio, precioNuevoCentavos: precioNuevo }
      })
      .filter((x) => x !== null)
  },

  /** Aplica el ajuste solo a los productos elegidos en la vista previa,
   * recalculando desde el costo ACTUAL de cada uno al momento de aplicar (no
   * desde los valores ya vistos en la preview, por si algo cambió mientras
   * tanto) — mismo criterio que categoriaService.aplicarRecalculo. */
  async aplicarAjusteCosto(id: string, organizationId: string, porcentaje: number, productIds: string[]) {
    await prisma.provider.findFirstOrThrow({ where: { id, organizationId } })
    const productos = await prisma.product.findMany({
      where: { id: { in: productIds }, providerId: id, organizationId, activo: true },
    })
    await prisma.$transaction(
      productos.flatMap((p) => {
        const costo = p.esPesable ? (p.costoPorKgCentavos ?? 0) : p.costoCentavos
        const precio = p.esPesable ? (p.precioPorKgCentavos ?? 0) : p.precioCentavos
        if (costo <= 0) return []
        const costoNuevo = Math.round(costo * (1 + porcentaje / 100))
        const markupActual = markupBpDesdeCostoYPrecio(costo, precio)
        const precioNuevo = precioDesdeCosoYMarkup(costoNuevo, markupActual)
        return [
          prisma.product.update({
            where: { id: p.id },
            data: p.esPesable
              ? { costoPorKgCentavos: costoNuevo, precioPorKgCentavos: precioNuevo }
              : { costoCentavos: costoNuevo, precioCentavos: precioNuevo },
          }),
        ]
      })
    )
    return { actualizados: productos.length }
  },
}

// ─── Ubicaciones (heladeras) ─────────────────────────────────────────────────

export const ubicacionService = {
  async listar(organizationId: string) {
    return prisma.location.findMany({
      where: { organizationId },
      include: { _count: { select: { products: true } } },
      orderBy: { nombre: "asc" },
    })
  },

  async crear(organizationId: string, data: { nombre: string }) {
    return prisma.location.create({ data: { ...data, organizationId } })
  },

  async editar(id: string, organizationId: string, data: { nombre: string }) {
    await prisma.location.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.location.update({ where: { id }, data })
  },

  async desactivar(id: string, organizationId: string) {
    await prisma.location.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.location.update({ where: { id }, data: { activo: false } })
  },

  async reactivar(id: string, organizationId: string) {
    await prisma.location.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.location.update({ where: { id }, data: { activo: true } })
  },

  async eliminar(id: string, organizationId: string) {
    await prisma.location.findFirstOrThrow({ where: { id, organizationId } })
    const productos = await prisma.product.count({ where: { locationId: id } })
    if (productos > 0) throw new Error(`No se puede eliminar: tiene ${productos} producto(s) asociado(s)`)
    return prisma.location.delete({ where: { id } })
  },
}

// ─── Medios de pago ──────────────────────────────────────────────────────────

export const medioPagoService = {
  async listar(organizationId: string) {
    return prisma.paymentMethod.findMany({
      where: { organizationId },
      orderBy: { orden: "asc" },
    })
  },

  async crear(
    organizationId: string,
    data: {
      nombre: string; comisionBp: number; esEfectivo?: boolean; esMercadoPago?: boolean; cajaId?: string | null
      recargoTipo?: "PORCENTUAL" | "FIJO"; recargoVirtualBp?: number; recargoVirtualFijoCentavos?: number
      mpExternalPosId?: string | null; mpTerminalId?: string | null
      facturarAutomaticamente?: boolean
    }
  ) {
    const maxOrden = await prisma.paymentMethod.aggregate({
      where: { organizationId },
      _max: { orden: true },
    })
    if (data.cajaId) {
      await prisma.caja.findFirstOrThrow({ where: { id: data.cajaId, organizationId } })
    }
    const esEfectivo = data.esEfectivo ?? false
    return prisma.paymentMethod.create({
      data: {
        ...data,
        esEfectivo,
        esMercadoPago: data.esMercadoPago ?? false,
        recargoTipo: data.recargoTipo ?? "PORCENTUAL",
        recargoVirtualBp: data.recargoVirtualBp ?? 0,
        recargoVirtualFijoCentavos: data.recargoVirtualFijoCentavos ?? 0,
        // Regla de negocio (no una preferencia editable): efectivo NUNCA
        // factura, cualquier medio no-efectivo (QR, Posnet, Transferencia)
        // SIEMPRE factura automático — ver Fase B de facturación/tickets.
        facturarAutomaticamente: !esEfectivo,
        esDefault: false,
        orden: (maxOrden._max.orden ?? -1) + 1,
        organizationId,
      },
    })
  },

  async editar(
    id: string,
    organizationId: string,
    data: {
      nombre?: string; comisionBp?: number; esEfectivo?: boolean; esMercadoPago?: boolean; activo?: boolean; cajaId?: string | null
      recargoTipo?: "PORCENTUAL" | "FIJO"; recargoVirtualBp?: number; recargoVirtualFijoCentavos?: number
      mpExternalPosId?: string | null; mpTerminalId?: string | null
      facturarAutomaticamente?: boolean
    }
  ) {
    const actual = await prisma.paymentMethod.findFirstOrThrow({ where: { id, organizationId } })
    if (data.cajaId) {
      await prisma.caja.findFirstOrThrow({ where: { id: data.cajaId, organizationId } })
    }
    const esEfectivo = data.esEfectivo ?? actual.esEfectivo
    return prisma.paymentMethod.update({
      where: { id },
      // Misma regla obligatoria que en `crear`: recalculada acá para que un
      // cambio de tipo (ej. de "digital" a "efectivo") no deje colgado un
      // facturarAutomaticamente que ya no corresponde.
      data: { ...data, facturarAutomaticamente: !esEfectivo },
    })
  },

  async desactivar(id: string, organizationId: string) {
    const mp = await prisma.paymentMethod.findFirstOrThrow({ where: { id, organizationId } })

    // Garantizar ≥1 medio activo
    const activosCount = await prisma.paymentMethod.count({
      where: { organizationId, activo: true },
    })
    if (activosCount <= 1) throw new Error("Debe quedar al menos un medio de pago activo")

    // Si era el default, asignar el default al siguiente activo
    if (mp.esDefault) {
      const siguiente = await prisma.paymentMethod.findFirst({
        where: { organizationId, activo: true, id: { not: id } },
        orderBy: { orden: "asc" },
      })
      if (siguiente) {
        await prisma.paymentMethod.update({ where: { id: siguiente.id }, data: { esDefault: true } })
      }
    }

    return prisma.paymentMethod.update({ where: { id }, data: { activo: false, esDefault: false } })
  },

  async reactivar(id: string, organizationId: string) {
    await prisma.paymentMethod.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.paymentMethod.update({ where: { id }, data: { activo: true } })
  },

  async setDefault(id: string, organizationId: string) {
    const mp = await prisma.paymentMethod.findFirstOrThrow({ where: { id, organizationId } })
    if (!mp.activo) throw new Error("Solo se puede marcar como default un medio activo")

    // Desmarcar el default anterior y marcar el nuevo en transacción
    await prisma.$transaction([
      prisma.paymentMethod.updateMany({
        where: { organizationId, esDefault: true },
        data: { esDefault: false },
      }),
      prisma.paymentMethod.update({ where: { id }, data: { esDefault: true } }),
    ])
  },

  async moverOrden(id: string, organizationId: string, direccion: "arriba" | "abajo") {
    const mp = await prisma.paymentMethod.findFirstOrThrow({ where: { id, organizationId } })
    const todos = await prisma.paymentMethod.findMany({
      where: { organizationId },
      orderBy: { orden: "asc" },
    })
    const idx = todos.findIndex((m) => m.id === id)
    const swapIdx = direccion === "arriba" ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= todos.length) return

    const swap = todos[swapIdx]
    await prisma.$transaction([
      prisma.paymentMethod.update({ where: { id: mp.id }, data: { orden: swap.orden } }),
      prisma.paymentMethod.update({ where: { id: swap.id }, data: { orden: mp.orden } }),
    ])
  },
}

// ─── Gastos fijos ─────────────────────────────────────────────────────────────

export const gastoFijoService = {
  // Incluye cuánto se pagó YA este mes (suma de EGRESOs de caja vinculados,
  // ver `pagar` más abajo) para que la UI pueda mostrar pagado/pendiente por
  // gasto fijo, no solo el monto presupuestado.
  async listar(organizationId: string) {
    const [gastos, pagosDelMes] = await Promise.all([
      prisma.fixedExpense.findMany({
        where: { organizationId },
        include: {
          montos: { orderBy: { mesAnio: "desc" }, take: 12 },
        },
        orderBy: { nombre: "asc" },
      }),
      prisma.movimientoCaja.groupBy({
        by: ["fixedExpenseId"],
        where: {
          organizationId,
          tipo: "EGRESO",
          fixedExpenseId: { not: null },
          fecha: { gte: inicioMes(), lte: finMes() },
        },
        _sum: { montoCentavos: true },
      }),
    ])

    const pagadoPorGasto = new Map(pagosDelMes.map((p) => [p.fixedExpenseId, p._sum.montoCentavos ?? 0]))
    return gastos.map((g) => ({ ...g, pagadoMesActualCentavos: pagadoPorGasto.get(g.id) ?? 0 }))
  },

  async crear(
    organizationId: string,
    data: { nombre: string; montoMensualCentavos: number; mesAnio?: string }
  ) {
    const mes = data.mesAnio ?? mesAnioActual()
    return prisma.fixedExpense.create({
      data: {
        nombre: data.nombre,
        organizationId,
        montos: { create: { mesAnio: mes, montoCentavos: data.montoMensualCentavos } },
      },
      include: { montos: true },
    })
  },

  async editar(id: string, organizationId: string, data: { nombre: string }) {
    await prisma.fixedExpense.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.fixedExpense.update({ where: { id }, data: { nombre: data.nombre } })
  },

  async actualizarMonto(
    id: string,
    organizationId: string,
    montoCentavos: number,
    mesAnio?: string
  ) {
    await prisma.fixedExpense.findFirstOrThrow({ where: { id, organizationId } })
    const mes = mesAnio ?? mesAnioActual()
    return prisma.fixedExpenseMonto.upsert({
      where: { fixedExpenseId_mesAnio: { fixedExpenseId: id, mesAnio: mes } },
      create: { fixedExpenseId: id, mesAnio: mes, montoCentavos },
      update: { montoCentavos },
    })
  },

  async desactivar(id: string, organizationId: string) {
    await prisma.fixedExpense.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.fixedExpense.update({ where: { id }, data: { activo: false } })
  },

  async reactivar(id: string, organizationId: string) {
    await prisma.fixedExpense.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.fixedExpense.update({ where: { id }, data: { activo: true } })
  },

  /** Registra el pago de un gasto fijo: crea un EGRESO real en la caja
   * elegida, vinculado a este gasto fijo (`fixedExpenseId`) para que el
   * equilibrio de Inicio pueda descontarlo de "a pagar" en vez de contarlo
   * dos veces (la plata ya salió de la caja Y seguía figurando como pendiente). */
  async pagar(id: string, organizationId: string, montoCentavos: number, cajaId: string) {
    return prisma.$transaction(async (tx) => {
      const gasto = await tx.fixedExpense.findFirstOrThrow({ where: { id, organizationId } })
      const caja = await tx.caja.findFirstOrThrow({ where: { id: cajaId, organizationId } })
      const sesion = await tx.cajaSesion.findFirst({ where: { cajaId, estado: "ABIERTA" } })
      if (!sesion) throw new Error(`Abrí la ${caja.nombre} antes de registrar el pago`)

      return tx.movimientoCaja.create({
        data: {
          cajaSesionId: sesion.id,
          cajaId,
          tipo: "EGRESO",
          montoCentavos,
          nota: `Pago de gasto fijo: ${gasto.nombre}`,
          fixedExpenseId: id,
          organizationId,
        },
      })
    })
  },
}

// ─── Organización ─────────────────────────────────────────────────────────────

export const organizacionService = {
  async obtener(organizationId: string) {
    return prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
  },

  /** Chequeo liviano para el gate del layout — evita traer la fila completa en cada carga. */
  async obtenerOnboardingStatus(organizationId: string) {
    return prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { onboardingCompletadoAt: true, estadoPago: true, trialTerminaEl: true },
    })
  },

  async actualizar(
    organizationId: string,
    data: {
      nombre?: string
      cuit?: string | null
      condicionIva?: string | null
      puntoDeVenta?: number | null
      facturacionModoProduccion?: boolean
      imprimirTicketPosnet?: boolean
      stockMinimoDefault?: number
      horariosArqueo?: string | null
      sueldoObjetivoCentavos?: number
      monotributoCentavos?: number
    }
  ) {
    return prisma.organization.update({ where: { id: organizationId }, data })
  },

  async completarOnboarding(organizationId: string) {
    return prisma.organization.update({
      where: { id: organizationId },
      data: { onboardingCompletadoAt: new Date(), trialTerminaEl: calcularTrialTerminaEl() },
    })
  },

  async resetearOnboarding(organizationId: string) {
    return prisma.organization.update({
      where: { id: organizationId },
      data: { onboardingCompletadoAt: null },
    })
  },

}

// ─── Usuarios ────────────────────────────────────────────────────────────────

export const usuarioService = {
  async listar(organizationId: string) {
    const usuarios = await prisma.user.findMany({
      where: { organizationId },
      select: { id: true, nombre: true, email: true, role: true, activo: true, createdAt: true, pinHash: true },
      orderBy: { nombre: "asc" },
    })
    // No exponemos el hash del PIN al cliente, solo si tiene uno configurado.
    return usuarios.map(({ pinHash, ...u }) => ({ ...u, tienePin: pinHash !== null }))
  },

  // Altas/bajas de usuarios escriben SIEMPRE contra Neon (además de local): el
  // login valida siempre contra Neon (ver @/lib/prisma-auth), así que si esto
  // solo tocara la base local del kiosco, un vendedor desactivado seguiría
  // pudiendo loguearse hasta el próximo backup nocturno — hueco de acceso real,
  // no solo demora cosmética. Son operaciones de baja frecuencia (altas/bajas
  // de empleados), no afectan la velocidad del POS.
  //
  // Fuera del kiosco (Vercel, o dev normal) `prisma` y `prismaAuth` son el
  // mismo Neon — NEON_DATABASE_URL solo la setea el arranque del kiosco. Ahí
  // escribir dos veces duplicaría el insert/update contra la misma fila, así
  // que la escritura a `prismaAuth` se salta cuando no es una base distinta.
  async crear(
    organizationId: string,
    data: { nombre: string; email: string; password: string; role: "ADMIN" | "VENDEDOR" }
  ) {
    const esKioscoLocal = !!process.env.NEON_DATABASE_URL
    const existenteNeon = await prismaAuth.user.findUnique({ where: { email: data.email } })
    if (existenteNeon) throw new Error("Ya existe un usuario con ese email")
    const passwordHash = await bcrypt.hash(data.password, 10)
    // Mismo id explícito en las dos bases — si cada una generara el suyo, el
    // backup nocturno (que hace upsert por id) crearía un segundo usuario
    // duplicado en Neon con el mismo email (choca con el @unique de User.email).
    const id = crypto.randomUUID()
    const datosUsuario = { id, nombre: data.nombre, email: data.email, passwordHash, role: data.role, organizationId }
    const select = { id: true, nombre: true, email: true, role: true, activo: true, createdAt: true } as const
    if (esKioscoLocal) await prismaAuth.user.create({ data: datosUsuario, select })
    return prisma.user.create({ data: datosUsuario, select })
  },

  async desactivar(id: string, organizationId: string, currentUserId: string) {
    if (id === currentUserId) throw new Error("No podés desactivar tu propio usuario")
    await prisma.user.findFirstOrThrow({ where: { id, organizationId } })
    if (process.env.NEON_DATABASE_URL) await prismaAuth.user.update({ where: { id }, data: { activo: false } })
    return prisma.user.update({ where: { id }, data: { activo: false } })
  },

  async reactivar(id: string, organizationId: string) {
    await prisma.user.findFirstOrThrow({ where: { id, organizationId } })
    if (process.env.NEON_DATABASE_URL) await prismaAuth.user.update({ where: { id }, data: { activo: true } })
    return prisma.user.update({ where: { id }, data: { activo: true } })
  },

  async cambiarRol(id: string, organizationId: string, role: "ADMIN" | "VENDEDOR", currentUserId: string) {
    if (id === currentUserId) throw new Error("No podés cambiar tu propio rol")
    await prisma.user.findFirstOrThrow({ where: { id, organizationId } })
    if (process.env.NEON_DATABASE_URL) await prismaAuth.user.update({ where: { id }, data: { role } })
    return prisma.user.update({ where: { id }, data: { role } })
  },

  /** Perfiles con PIN activos de la organización, para el selector de cambio
   * rápido de usuario en el kiosco — accesible a cualquier usuario logueado,
   * no solo al admin (cualquiera puede cambiar a otro perfil). Incluye
   * cuentas ADMIN con PIN a propósito: decisión consciente del dueño
   * (2026-07-10) que prioriza la practicidad de acceso rápido sobre el
   * riesgo — cualquiera con acceso físico al kiosco que sepa ese PIN entra
   * como admin completo. `role` se expone al cliente para que el switcher
   * pueda mostrar quién es admin, no para ocultarlo. */
  async listarPerfilesConPin(organizationId: string) {
    return prisma.user.findMany({
      where: { organizationId, activo: true, pinHash: { not: null } },
      select: { id: true, nombre: true, role: true },
      orderBy: { nombre: "asc" },
    })
  },

  // Perfil de empleado sin login propio (sin email/contraseña) — solo nombre +
  // PIN de 4 dígitos, pensado para cambio rápido de usuario en el kiosco
  // físico. Siempre VENDEDOR: un ADMIN ya tiene su propio login con Google o
  // contraseña. Mismo dual-write a Neon que `crear` — ver comentario ahí.
  async crearPerfilPin(organizationId: string, data: { nombre: string; pin: string }) {
    const esKioscoLocal = !!process.env.NEON_DATABASE_URL
    const pinHash = await bcrypt.hash(data.pin, 10)
    const id = crypto.randomUUID()
    const datosUsuario = {
      id, nombre: data.nombre, email: null, pinHash, role: "VENDEDOR" as const, organizationId,
    }
    const select = { id: true, nombre: true, role: true, activo: true, createdAt: true } as const
    if (esKioscoLocal) await prismaAuth.user.create({ data: datosUsuario, select })
    return prisma.user.create({ data: datosUsuario, select })
  },

  /** Setea/cambia el PIN de un perfil existente (limpia el bloqueo por
   * fuerza bruta de paso, como un reseteo de contraseña). Permitido también
   * sobre cuentas ADMIN — el dueño decidió priorizar la practicidad de
   * acceso rápido en el kiosco sobre el riesgo de que un PIN de 4 dígitos
   * habilite sesión de administrador completa (2026-07-10). */
  async resetearPin(id: string, organizationId: string, pin: string) {
    await prisma.user.findFirstOrThrow({ where: { id, organizationId } })
    const pinHash = await bcrypt.hash(pin, 10)
    const data = { pinHash, failedLoginAttempts: 0, lockedUntil: null }
    if (process.env.NEON_DATABASE_URL) await prismaAuth.user.update({ where: { id }, data })
    return prisma.user.update({ where: { id }, data })
  },
}
