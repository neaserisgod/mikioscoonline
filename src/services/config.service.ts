import { prisma } from "@/lib/prisma"
import { mesAnioActual } from "@/domain/dinero"
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
    data: { nombre: string; comisionBp: number; esMercadoPago?: boolean }
  ) {
    const maxOrden = await prisma.paymentMethod.aggregate({
      where: { organizationId },
      _max: { orden: true },
    })
    return prisma.paymentMethod.create({
      data: {
        ...data,
        esMercadoPago: data.esMercadoPago ?? false,
        esDefault: false,
        orden: (maxOrden._max.orden ?? -1) + 1,
        organizationId,
      },
    })
  },

  async editar(
    id: string,
    organizationId: string,
    data: { nombre?: string; comisionBp?: number; esMercadoPago?: boolean; activo?: boolean }
  ) {
    await prisma.paymentMethod.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.paymentMethod.update({ where: { id }, data })
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
  async listar(organizationId: string) {
    return prisma.fixedExpense.findMany({
      where: { organizationId },
      include: {
        montos: { orderBy: { mesAnio: "desc" }, take: 12 },
      },
      orderBy: { nombre: "asc" },
    })
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
}

// ─── Organización ─────────────────────────────────────────────────────────────

export const organizacionService = {
  async obtener(organizationId: string) {
    return prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
  },

  async actualizar(
    organizationId: string,
    data: {
      nombre?: string
      cuit?: string | null
      condicionIva?: string | null
      puntoDeVenta?: number | null
      stockMinimoDefault?: number
    }
  ) {
    return prisma.organization.update({ where: { id: organizationId }, data })
  },
}

// ─── Usuarios ────────────────────────────────────────────────────────────────

export const usuarioService = {
  async listar(organizationId: string) {
    return prisma.user.findMany({
      where: { organizationId },
      select: { id: true, nombre: true, email: true, role: true, activo: true, createdAt: true },
      orderBy: { nombre: "asc" },
    })
  },

  async crear(
    organizationId: string,
    data: { nombre: string; email: string; password: string; role: "ADMIN" | "VENDEDOR" }
  ) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) throw new Error("Ya existe un usuario con ese email")
    const passwordHash = await bcrypt.hash(data.password, 10)
    return prisma.user.create({
      data: { nombre: data.nombre, email: data.email, passwordHash, role: data.role, organizationId },
      select: { id: true, nombre: true, email: true, role: true, activo: true, createdAt: true },
    })
  },

  async desactivar(id: string, organizationId: string, currentUserId: string) {
    if (id === currentUserId) throw new Error("No podés desactivar tu propio usuario")
    await prisma.user.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.user.update({ where: { id }, data: { activo: false } })
  },

  async reactivar(id: string, organizationId: string) {
    await prisma.user.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.user.update({ where: { id }, data: { activo: true } })
  },

  async cambiarRol(id: string, organizationId: string, role: "ADMIN" | "VENDEDOR", currentUserId: string) {
    if (id === currentUserId) throw new Error("No podés cambiar tu propio rol")
    await prisma.user.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.user.update({ where: { id }, data: { role } })
  },
}
