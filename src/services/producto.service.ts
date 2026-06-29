import { prisma } from "@/lib/prisma"
import { resolverTriangulo } from "@/domain/markup"
import Papa from "papaparse"

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CrearProductoInput {
  sku: string
  barcode?: string
  nombre: string
  categoryId: string
  providerId?: string
  locationId?: string
  stock?: number
  stockMinimo?: number
  organizationId: string
  costoCentavos?: number
  precioCentavos?: number
  markupBp?: number
}

export interface EditarProductoInput {
  id: string
  organizationId: string
  sku?: string
  barcode?: string
  nombre?: string
  categoryId?: string
  providerId?: string | null
  locationId?: string | null
  stock?: number
  stockMinimo?: number
  costoCentavos?: number
  precioCentavos?: number
  markupBp?: number
}

export interface FilaCSV {
  sku: string
  nombre: string
  costo?: string
  precio?: string
  categoria: string
  proveedor?: string
  heladera?: string
  barcode?: string
}

const incluirRelaciones = {
  category: true,
  provider: true,
  location: true,
} as const

// ─── Servicio ─────────────────────────────────────────────────────────────────

export const productoService = {
  async crear(input: CrearProductoInput) {
    const category = await prisma.category.findUniqueOrThrow({
      where: { id: input.categoryId },
    })

    const triangulo = resolverTriangulo({
      costoCentavos: input.costoCentavos,
      precioCentavos: input.precioCentavos,
      markupBp: input.markupBp,
      markupDefaultBp: category.markupDefaultBp,
      markupDefaultTipo: (category.markupDefaultTipo as "PORCENTUAL" | "FIJO"),
      markupDefaultFijoCentavos: category.markupDefaultFijoCentavos,
    })

    return prisma.product.create({
      data: {
        sku: input.sku,
        barcode: input.barcode ?? null,
        nombre: input.nombre,
        costoCentavos: triangulo.costoCentavos,
        precioCentavos: triangulo.precioCentavos,
        costoEsProvisional: triangulo.costoEsProvisional,
        categoryId: input.categoryId,
        providerId: input.providerId ?? null,
        locationId: input.locationId ?? null,
        stock: input.stock ?? 0,
        stockMinimo: input.stockMinimo ?? 0,
        organizationId: input.organizationId,
      },
      include: incluirRelaciones,
    })
  },

  async editar(input: EditarProductoInput) {
    const producto = await prisma.product.findFirstOrThrow({
      where: { id: input.id, organizationId: input.organizationId },
      include: { category: true },
    })

    const cat = input.categoryId
      ? await prisma.category.findUniqueOrThrow({ where: { id: input.categoryId } })
      : producto.category

    let triangulo: ReturnType<typeof resolverTriangulo> | null = null
    if (input.costoCentavos !== undefined || input.precioCentavos !== undefined || input.markupBp !== undefined) {
      triangulo = resolverTriangulo({
        costoCentavos: input.costoCentavos ?? producto.costoCentavos,
        precioCentavos: input.precioCentavos ?? producto.precioCentavos,
        markupBp: input.markupBp,
        markupDefaultBp: cat.markupDefaultBp,
        markupDefaultTipo: (cat.markupDefaultTipo as "PORCENTUAL" | "FIJO"),
        markupDefaultFijoCentavos: cat.markupDefaultFijoCentavos,
      })
    }

    return prisma.product.update({
      where: { id: input.id },
      data: {
        ...(input.sku !== undefined && { sku: input.sku }),
        ...(input.barcode !== undefined && { barcode: input.barcode }),
        ...(input.nombre !== undefined && { nombre: input.nombre }),
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        ...(input.providerId !== undefined && { providerId: input.providerId }),
        ...(input.locationId !== undefined && { locationId: input.locationId }),
        ...(input.stock !== undefined && { stock: input.stock }),
        ...(input.stockMinimo !== undefined && { stockMinimo: input.stockMinimo }),
        ...(triangulo && {
          costoCentavos: triangulo.costoCentavos,
          precioCentavos: triangulo.precioCentavos,
          costoEsProvisional: triangulo.costoEsProvisional,
        }),
      },
      include: incluirRelaciones,
    })
  },

  async actualizarCosto(id: string, organizationId: string, costoCentavos: number) {
    await prisma.product.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.product.update({
      where: { id },
      data: { costoCentavos, costoEsProvisional: false },
      include: incluirRelaciones,
    })
  },

  async obtener(id: string, organizationId: string) {
    return prisma.product.findFirst({
      where: { id, organizationId },
      include: incluirRelaciones,
    })
  },

  async listar(organizationId: string) {
    return prisma.product.findMany({
      where: { organizationId, activo: true },
      include: incluirRelaciones,
      orderBy: { nombre: "asc" },
    })
  },

  async buscar(organizationId: string, query: string) {
    return prisma.product.findMany({
      where: {
        organizationId,
        activo: true,
        OR: [
          { nombre: { contains: query, mode: "insensitive" } },
          { sku: { contains: query, mode: "insensitive" } },
          { barcode: query }, // búsqueda exacta de barcode
        ],
      },
      include: incluirRelaciones,
      take: 50,
    })
  },

  async buscarPorCodigo(barcode: string, organizationId: string) {
    return prisma.product.findFirst({
      where: { barcode, organizationId, activo: true },
      include: incluirRelaciones,
    })
  },

  async stockBajo(organizationId: string) {
    // Prisma no soporta comparar dos columnas en where → raw query
    return prisma.$queryRaw<
      Array<{ id: string; sku: string; nombre: string; stock: number; stockMinimo: number }>
    >`
      SELECT id, sku, nombre, stock, "stockMinimo"
      FROM "Product"
      WHERE "organizationId" = ${organizationId}
        AND activo = true
        AND stock <= "stockMinimo"
      ORDER BY nombre
    `
  },

  async desactivar(id: string, organizationId: string) {
    await prisma.product.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.product.update({ where: { id }, data: { activo: false } })
  },

  async importarCSV(csv: string, organizationId: string) {
    const { data, errors: parseErrors } = Papa.parse<FilaCSV>(csv, {
      header: true,
      skipEmptyLines: true,
    })

    if (parseErrors.length > 0) {
      return { creados: 0, actualizados: 0, errores: parseErrors.map(e => ({ fila: e.row ?? 0, error: e.message })) }
    }

    let creados = 0
    let actualizados = 0
    const errores: Array<{ fila: number; error: string }> = []

    for (const [idx, row] of data.entries()) {
      const fila = idx + 2
      try {
        if (!row.sku || !row.nombre || !row.categoria) {
          errores.push({ fila, error: "Faltan columnas obligatorias: sku, nombre, categoria" })
          continue
        }

        const category = await prisma.category.upsert({
          where: { nombre_organizationId: { nombre: row.categoria, organizationId } },
          create: { nombre: row.categoria, markupDefaultBp: 5000, organizationId },
          update: {},
        })

        const provider = row.proveedor
          ? await prisma.provider.upsert({
              where: { nombre_organizationId: { nombre: row.proveedor, organizationId } },
              create: { nombre: row.proveedor, organizationId },
              update: {},
            })
          : null

        const location = row.heladera
          ? await prisma.location.upsert({
              where: { nombre_organizationId: { nombre: row.heladera, organizationId } },
              create: { nombre: row.heladera, organizationId },
              update: {},
            })
          : null

        const costoCentavos = row.costo ? Math.round(parseFloat(row.costo) * 100) : undefined
        const precioCentavos = row.precio ? Math.round(parseFloat(row.precio) * 100) : undefined

        const triangulo = resolverTriangulo({
          costoCentavos,
          precioCentavos,
          markupDefaultBp: category.markupDefaultBp,
          markupDefaultTipo: (category.markupDefaultTipo as "PORCENTUAL" | "FIJO"),
          markupDefaultFijoCentavos: category.markupDefaultFijoCentavos,
        })

        const existing = await prisma.product.findFirst({
          where: { sku: row.sku, organizationId },
        })

        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              nombre: row.nombre,
              barcode: row.barcode ?? null,
              costoCentavos: triangulo.costoCentavos,
              precioCentavos: triangulo.precioCentavos,
              costoEsProvisional: triangulo.costoEsProvisional,
              categoryId: category.id,
              providerId: provider?.id ?? null,
              locationId: location?.id ?? null,
            },
          })
          actualizados++
        } else {
          await prisma.product.create({
            data: {
              sku: row.sku,
              barcode: row.barcode ?? null,
              nombre: row.nombre,
              costoCentavos: triangulo.costoCentavos,
              precioCentavos: triangulo.precioCentavos,
              costoEsProvisional: triangulo.costoEsProvisional,
              categoryId: category.id,
              providerId: provider?.id ?? null,
              locationId: location?.id ?? null,
              organizationId,
            },
          })
          creados++
        }
      } catch (e) {
        errores.push({ fila, error: e instanceof Error ? e.message : String(e) })
      }
    }

    return { creados, actualizados, errores }
  },
}
