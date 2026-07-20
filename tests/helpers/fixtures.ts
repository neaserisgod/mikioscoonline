import type { PrismaClient } from "@prisma/client"

/** Fixtures mínimos para tests de integración — arman el grafo relacional
 * mínimo que ventaService/productoService necesitan (organización, usuario,
 * categoría, caja principal con sesión abierta, medio de pago efectivo). */

export async function crearOrganizacion(prisma: PrismaClient, data?: { nombre?: string }) {
  return prisma.organization.create({
    data: { nombre: data?.nombre ?? "Kiosco de test" },
  })
}

export async function crearUsuario(prisma: PrismaClient, organizationId: string, data?: { nombre?: string; role?: "ADMIN" | "VENDEDOR" }) {
  return prisma.user.create({
    data: {
      nombre: data?.nombre ?? "Usuario de test",
      role: data?.role ?? "ADMIN",
      organizationId,
    },
  })
}

export async function crearCategoria(prisma: PrismaClient, organizationId: string, data?: { nombre?: string; markupDefaultBp?: number }) {
  return prisma.category.create({
    data: {
      nombre: data?.nombre ?? `Categoria-${crypto.randomUUID().slice(0, 8)}`,
      markupDefaultBp: data?.markupDefaultBp ?? 5000,
      organizationId,
    },
  })
}

/** Caja principal + sesión abierta — requerida por ventaService.crear (paso 2.5/7.5). */
export async function crearCajaPrincipalAbierta(prisma: PrismaClient, organizationId: string, userId: string) {
  const caja = await prisma.caja.create({
    data: { nombre: "Caja general", esPrincipal: true, organizationId },
  })
  const sesion = await prisma.cajaSesion.create({
    data: {
      cajaId: caja.id,
      abiertaPorUserId: userId,
      fondoInicialCentavos: 0,
      estado: "ABIERTA",
      organizationId,
    },
  })
  return { caja, sesion }
}

export async function crearMedioPagoEfectivo(prisma: PrismaClient, organizationId: string) {
  return prisma.paymentMethod.create({
    data: { nombre: "Efectivo", esEfectivo: true, organizationId },
  })
}

export async function crearProducto(
  prisma: PrismaClient,
  organizationId: string,
  categoryId: string,
  data?: Partial<{
    nombre: string; stock: number; precioCentavos: number; costoCentavos: number
    esPesable: boolean; stockGramos: number
  }>
) {
  return prisma.product.create({
    data: {
      sku: `SKU-${crypto.randomUUID().slice(0, 8)}`,
      nombre: data?.nombre ?? "Producto de test",
      precioCentavos: data?.precioCentavos ?? 100000,
      costoCentavos: data?.costoCentavos ?? 50000,
      stock: data?.stock ?? 10,
      esPesable: data?.esPesable ?? false,
      stockGramos: data?.esPesable ? (data?.stockGramos ?? 1000) : null,
      categoryId,
      organizationId,
    },
  })
}

/** Escenario completo listo para ventaService.crear: organización + admin +
 * categoría + caja principal abierta + medio de pago efectivo + un producto. */
export async function crearEscenarioVentaBasico(prisma: PrismaClient, opts?: { stockProducto?: number }) {
  const organization = await crearOrganizacion(prisma)
  const user = await crearUsuario(prisma, organization.id)
  const category = await crearCategoria(prisma, organization.id)
  const { caja, sesion } = await crearCajaPrincipalAbierta(prisma, organization.id, user.id)
  const medioEfectivo = await crearMedioPagoEfectivo(prisma, organization.id)
  const producto = await crearProducto(prisma, organization.id, category.id, { stock: opts?.stockProducto ?? 10 })

  return { organization, user, category, caja, sesion, medioEfectivo, producto }
}
