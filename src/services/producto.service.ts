import { prisma } from "@/lib/prisma"
import { resolverTriangulo } from "@/domain/markup"
import { gananciaPotencial, valoresInventario } from "@/domain/pesables"
import { normalizarTexto } from "@/lib/utils"
import Papa from "papaparse"

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CrearProductoInput {
  sku?: string
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
  // Pesables (vendidos por peso) — ver domain/pesables.ts
  esPesable?: boolean
  costoPorKgCentavos?: number
  precioPorKgCentavos?: number
  stockGramos?: number
  stockMinimoGramos?: number
  // Variantes que comparten stock (Fase 1: sin selector en UI todavía) — ver
  // Product.variantOfId/unidadesPorVenta en el schema.
  variantOfId?: string | null
  unidadesPorVenta?: number
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
  esPesable?: boolean
  costoPorKgCentavos?: number
  precioPorKgCentavos?: number
  stockGramos?: number
  stockMinimoGramos?: number
  variantOfId?: string | null
  unidadesPorVenta?: number
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

// Solo se usa `nombre` de cada relación en las pantallas que consumen estas queries.
const incluirRelaciones = {
  category: { select: { nombre: true } },
  provider: { select: { nombre: true } },
  location: { select: { nombre: true } },
} as const

/** Productos sin código de barras (raros) necesitan igual un SKU único — se
 * genera uno interno en vez de pedírselo al usuario en el alta. */
async function generarSkuInterno(organizationId: string): Promise<string> {
  for (let intento = 0; intento < 5; intento++) {
    const candidato = `SC${Math.floor(100000 + Math.random() * 900000)}`
    const existe = await prisma.product.findFirst({ where: { sku: candidato, organizationId } })
    if (!existe) return candidato
  }
  throw new Error("No se pudo generar un SKU interno único, reintentá")
}

/**
 * Reglas de "variantes que comparten stock" (Product.variantOfId/unidadesPorVenta):
 * factor mínimo 1, sin cadenas (un dueño no puede ser a su vez variante de
 * otro) y sin mezclar con pesables (el stock de éstos vive en gramos, no en
 * unidades — el factor no tiene forma de aplicarse). `productId` va indefinido
 * al crear (todavía no tiene id ni puede tener variantes propias).
 */
async function validarVariante(input: {
  productId?: string
  organizationId: string
  variantOfId: string | null | undefined
  unidadesPorVenta: number | undefined
  esPesable: boolean
}) {
  if (input.unidadesPorVenta !== undefined && input.unidadesPorVenta < 1) {
    throw new Error("unidadesPorVenta debe ser mayor o igual a 1")
  }
  if (!input.variantOfId) return

  if (input.esPesable) {
    throw new Error("Un producto pesable no puede ser variante de otro (el stock se comparte por unidad, no por peso)")
  }
  if (input.productId && input.variantOfId === input.productId) {
    throw new Error("Un producto no puede ser variante de sí mismo")
  }

  const dueño = await prisma.product.findFirstOrThrow({
    where: { id: input.variantOfId, organizationId: input.organizationId },
    select: { variantOfId: true, esPesable: true },
  })
  if (dueño.variantOfId) {
    throw new Error("El producto elegido ya es variante de otro — no se permiten cadenas de variantes")
  }
  if (dueño.esPesable) {
    throw new Error("Un producto pesable no puede ser dueño de variantes por unidad")
  }

  if (input.productId) {
    const tieneVariantesPropias = await prisma.product.findFirst({
      where: { variantOfId: input.productId, organizationId: input.organizationId },
      select: { id: true },
    })
    if (tieneVariantesPropias) {
      throw new Error("Este producto ya tiene variantes propias — no puede pasar a ser variante de otro")
    }
  }
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

export const productoService = {
  async crear(input: CrearProductoInput) {
    const category = await prisma.category.findFirstOrThrow({
      where: { id: input.categoryId, organizationId: input.organizationId },
    })
    if (input.providerId) {
      await prisma.provider.findFirstOrThrow({ where: { id: input.providerId, organizationId: input.organizationId } })
    }
    if (input.locationId) {
      await prisma.location.findFirstOrThrow({ where: { id: input.locationId, organizationId: input.organizationId } })
    }

    const esPesable = input.esPesable ?? false
    await validarVariante({
      organizationId: input.organizationId,
      variantOfId: input.variantOfId,
      unidadesPorVenta: input.unidadesPorVenta,
      esPesable,
    })
    const triangulo = resolverTriangulo({
      costoCentavos: esPesable ? input.costoPorKgCentavos : input.costoCentavos,
      precioCentavos: esPesable ? input.precioPorKgCentavos : input.precioCentavos,
      markupBp: input.markupBp,
      markupDefaultBp: category.markupDefaultBp,
      markupDefaultTipo: (category.markupDefaultTipo as "PORCENTUAL" | "FIJO"),
      markupDefaultFijoCentavos: category.markupDefaultFijoCentavos,
    })

    // SKU = código de barras (convención de toda la app, ver importarCSV) — si no
    // hay código de barras, se genera un SKU interno para no pedírselo al usuario.
    const sku = input.sku || input.barcode || (await generarSkuInterno(input.organizationId))

    return prisma.product.create({
      data: {
        sku,
        barcode: input.barcode ?? null,
        nombre: input.nombre,
        // No pesable: costoCentavos/precioCentavos son los reales. Pesable: quedan en 0
        // (no se usan — ver domain/pesables.ts) y los valores viven en *PorKgCentavos.
        costoCentavos: esPesable ? 0 : triangulo.costoCentavos,
        precioCentavos: esPesable ? 0 : triangulo.precioCentavos,
        costoEsProvisional: triangulo.costoEsProvisional,
        categoryId: input.categoryId,
        providerId: input.providerId ?? null,
        locationId: input.locationId ?? null,
        stock: esPesable ? 0 : (input.stock ?? 0),
        stockMinimo: esPesable ? 0 : (input.stockMinimo ?? 0),
        esPesable,
        costoPorKgCentavos: esPesable ? triangulo.costoCentavos : null,
        precioPorKgCentavos: esPesable ? triangulo.precioCentavos : null,
        stockGramos: esPesable ? (input.stockGramos ?? 0) : null,
        stockMinimoGramos: esPesable ? (input.stockMinimoGramos ?? 0) : null,
        variantOfId: input.variantOfId ?? null,
        unidadesPorVenta: input.unidadesPorVenta ?? 1,
        organizationId: input.organizationId,
      },
      // Sin include: el resultado no se usa (las actions devuelven solo {ok, error})
    })
  },

  async editar(input: EditarProductoInput) {
    const producto = await prisma.product.findFirstOrThrow({
      where: { id: input.id, organizationId: input.organizationId },
      include: { category: true },
    })

    const cat = input.categoryId
      ? await prisma.category.findFirstOrThrow({ where: { id: input.categoryId, organizationId: input.organizationId } })
      : producto.category
    if (input.providerId) {
      await prisma.provider.findFirstOrThrow({ where: { id: input.providerId, organizationId: input.organizationId } })
    }
    if (input.locationId) {
      await prisma.location.findFirstOrThrow({ where: { id: input.locationId, organizationId: input.organizationId } })
    }

    const esPesable = input.esPesable ?? producto.esPesable
    if (input.variantOfId !== undefined || input.unidadesPorVenta !== undefined) {
      await validarVariante({
        productId: input.id,
        organizationId: input.organizationId,
        variantOfId: input.variantOfId !== undefined ? input.variantOfId : producto.variantOfId,
        unidadesPorVenta: input.unidadesPorVenta,
        esPesable,
      })
    }

    let triangulo: ReturnType<typeof resolverTriangulo> | null = null
    if (esPesable) {
      if (input.costoPorKgCentavos !== undefined || input.precioPorKgCentavos !== undefined || input.markupBp !== undefined) {
        triangulo = resolverTriangulo({
          costoCentavos: input.costoPorKgCentavos ?? producto.costoPorKgCentavos ?? undefined,
          precioCentavos: input.precioPorKgCentavos ?? producto.precioPorKgCentavos ?? undefined,
          markupBp: input.markupBp,
          markupDefaultBp: cat.markupDefaultBp,
          markupDefaultTipo: (cat.markupDefaultTipo as "PORCENTUAL" | "FIJO"),
          markupDefaultFijoCentavos: cat.markupDefaultFijoCentavos,
        })
      } else if (input.esPesable && !producto.esPesable) {
        // Se está activando "pesable" recién ahora — necesita precio/costo por kg
        throw new Error("Indicá precio o costo por kg para un producto pesable")
      }
    } else {
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
        ...(input.esPesable !== undefined && { esPesable: input.esPesable }),
        ...(input.variantOfId !== undefined && { variantOfId: input.variantOfId }),
        ...(input.unidadesPorVenta !== undefined && { unidadesPorVenta: input.unidadesPorVenta }),
        ...(esPesable
          ? {
              ...(input.stockGramos !== undefined && { stockGramos: input.stockGramos }),
              ...(input.stockMinimoGramos !== undefined && { stockMinimoGramos: input.stockMinimoGramos }),
              ...(triangulo && {
                costoPorKgCentavos: triangulo.costoCentavos,
                precioPorKgCentavos: triangulo.precioCentavos,
                costoEsProvisional: triangulo.costoEsProvisional,
              }),
            }
          : {
              ...(input.stock !== undefined && { stock: input.stock }),
              ...(input.stockMinimo !== undefined && { stockMinimo: input.stockMinimo }),
              ...(triangulo && {
                costoCentavos: triangulo.costoCentavos,
                precioCentavos: triangulo.precioCentavos,
                costoEsProvisional: triangulo.costoEsProvisional,
              }),
            }),
      },
      // Sin include: el resultado no se usa (las actions devuelven solo {ok, error})
    })
  },

  async actualizarCosto(id: string, organizationId: string, costoCentavos: number) {
    await prisma.product.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.product.update({
      where: { id },
      data: { costoCentavos, costoEsProvisional: false },
      // Sin include: el resultado no se usa (la action devuelve solo {ok, error})
    })
  },

  /** Usado al recibir un pedido de proveedor: pisa costo (y opcionalmente precio
   * de venta) con el valor real de la factura, apagando `costoEsProvisional`. */
  async actualizarCostoYPrecio(
    id: string,
    organizationId: string,
    data: { costoCentavos: number; precioCentavos: number }
  ) {
    await prisma.product.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.product.update({
      where: { id },
      data: { ...data, costoEsProvisional: false },
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

  /** Sync incremental de catálogo para el cliente offline (Flutter): trae también
   * los productos desactivados desde `since` para que el cache local los saque de
   * circulación, no solo los que siguen activos. */
  async listarDesde(organizationId: string, since: Date) {
    return prisma.product.findMany({
      where: { organizationId, updatedAt: { gt: since } },
      include: incluirRelaciones,
      orderBy: { updatedAt: "asc" },
    })
  },

  async buscar(organizationId: string, query: string) {
    // Filtro en JS (no `mode: "insensitive"`, exclusivo del conector Postgres/MongoDB
    // de Prisma) para funcionar igual en SQLite y Postgres. El catálogo es chico
    // (cientos de productos por organización), así que traer todo y filtrar acá
    // es instantáneo y evita depender de una feature específica del motor.
    const q = normalizarTexto(query)
    const productos = await prisma.product.findMany({
      where: { organizationId, activo: true },
      include: incluirRelaciones,
      orderBy: { nombre: "asc" },
    })
    return productos
      .filter((p) =>
        normalizarTexto(p.nombre).includes(q) ||
        normalizarTexto(p.sku).includes(q) ||
        p.barcode === query
      )
      .slice(0, 50)
  },

  /** Ranking de productos por cantidad de líneas de venta en los últimos
   * `dias` — para el acceso rápido de "Más vendidos" en el POS, así el
   * cajero no tiene que buscar los productos que salen todo el tiempo.
   * Cuenta apariciones en ventas, no unidades (pesables venden "1 línea" con
   * gramos variables, así que sumar cantidad los subrepresentaría). Excluye
   * consumo interno: no es una preferencia real de clientes. */
  async masVendidos(organizationId: string, dias: number, limit: number) {
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
    const ranking = await prisma.saleLine.groupBy({
      by: ["productId"],
      where: { sale: { organizationId, fecha: { gte: desde }, esConsumoInterno: false } },
      _count: { productId: true },
      orderBy: { _count: { productId: "desc" } },
      take: limit,
    })
    if (ranking.length === 0) return []

    const productos = await prisma.product.findMany({
      where: { id: { in: ranking.map((r) => r.productId) }, organizationId, activo: true },
      include: incluirRelaciones,
    })
    const porId = new Map(productos.map((p) => [p.id, p]))
    return ranking.map((r) => porId.get(r.productId)).filter((p) => p !== undefined)
  },

  async buscarPorCodigo(barcode: string, organizationId: string) {
    return prisma.product.findFirst({
      where: { barcode, organizationId, activo: true },
      include: incluirRelaciones,
    })
  },

  /** Cards de nivel 1 en Productos (Proveedores). Trae todo y agrupa en memoria
   * (mismo criterio que rentabilidad.service.ts: catálogo chico, cientos de
   * productos por organización como mucho). "Sin proveedor" usa el mismo
   * sentinel que ya usa rentabilidad.service.ts para consistencia. */
  async resumenProveedores(organizationId: string) {
    const productos = await prisma.product.findMany({
      where: { organizationId, activo: true },
      select: {
        providerId: true,
        provider: { select: { nombre: true } },
        stock: true,
        stockGramos: true,
        esPesable: true,
        precioCentavos: true,
        costoCentavos: true,
        precioPorKgCentavos: true,
        costoPorKgCentavos: true,
      },
    })

    const mapa = new Map<string, {
      id: string; nombre: string; totalProductos: number; sinStock: number
      gananciaPotencialCentavos: number; valorCostoCentavos: number; valorVentaCentavos: number
    }>()
    for (const p of productos) {
      const id = p.providerId ?? "__sin_proveedor__"
      const nombre = p.provider?.nombre ?? "Sin proveedor"
      const fila = mapa.get(id) ?? {
        id, nombre, totalProductos: 0, sinStock: 0,
        gananciaPotencialCentavos: 0, valorCostoCentavos: 0, valorVentaCentavos: 0,
      }
      fila.totalProductos++
      const sinStock = p.esPesable ? (p.stockGramos ?? 0) === 0 : p.stock === 0
      if (sinStock) fila.sinStock++
      fila.gananciaPotencialCentavos += gananciaPotencial(p)
      const v = valoresInventario(p)
      fila.valorCostoCentavos += v.valorCostoCentavos
      fila.valorVentaCentavos += v.valorVentaCentavos
      mapa.set(id, fila)
    }

    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  },

  /** Cards de nivel 2 en Productos (Categorías dentro de un proveedor).
   * `providerId: null` = bucket "Sin proveedor" del nivel 1. */
  async resumenCategorias(organizationId: string, providerId: string | null) {
    const productos = await prisma.product.findMany({
      where: { organizationId, activo: true, providerId },
      select: {
        categoryId: true,
        category: { select: { nombre: true } },
        stock: true,
        stockGramos: true,
        esPesable: true,
        precioCentavos: true,
        costoCentavos: true,
        precioPorKgCentavos: true,
        costoPorKgCentavos: true,
      },
    })

    const mapa = new Map<string, { id: string; nombre: string; totalProductos: number; gananciaPotencialCentavos: number }>()
    for (const p of productos) {
      const fila = mapa.get(p.categoryId) ?? { id: p.categoryId, nombre: p.category.nombre, totalProductos: 0, gananciaPotencialCentavos: 0 }
      fila.totalProductos++
      fila.gananciaPotencialCentavos += gananciaPotencial(p)
      mapa.set(p.categoryId, fila)
    }

    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  },

  /** Nivel 3 en Productos (lista filtrada por proveedor y/o categoría). */
  async listarFiltrado(organizationId: string, opts?: { providerId?: string; categoryId?: string }) {
    return prisma.product.findMany({
      where: {
        organizationId,
        activo: true,
        ...(opts?.providerId !== undefined && {
          providerId: opts.providerId === "__sin_proveedor__" ? null : opts.providerId,
        }),
        ...(opts?.categoryId !== undefined && { categoryId: opts.categoryId }),
      },
      include: incluirRelaciones,
      orderBy: { nombre: "asc" },
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

  /** Productos vendiéndose por debajo del costo (ver domain/markup.ts,
   * margenNegativo) — casi siempre un error de carga, no una promoción real.
   * Prisma no compara dos columnas en `where` → raw query solo para los ids,
   * después se pide el producto completo (misma forma que el resto de listar*). */
  async margenNegativo(organizationId: string) {
    const ids = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "Product"
      WHERE "organizationId" = ${organizationId}
        AND activo = true
        AND (
          (NOT "esPesable" AND "precioCentavos" < "costoCentavos")
          OR ("esPesable" AND "costoPorKgCentavos" IS NOT NULL AND COALESCE("precioPorKgCentavos", 0) < "costoPorKgCentavos")
        )
    `
    if (ids.length === 0) return []
    return prisma.product.findMany({
      where: { id: { in: ids.map((r) => r.id) } },
      include: incluirRelaciones,
      orderBy: { nombre: "asc" },
    })
  },

  /** Productos con costo cargado a ojo (ver domain/markup.ts, se marca al crear
   * sin factura real) pendientes de confirmar con el costo real de compra. */
  async costoProvisional(organizationId: string) {
    return prisma.product.findMany({
      where: { organizationId, activo: true, costoEsProvisional: true },
      include: incluirRelaciones,
      orderBy: { nombre: "asc" },
    })
  },

  /** Stock bajo de un proveedor puntual, para sugerir un pedido — ver
   * pedidos-client.tsx ("Sugerir pedido"). Excluye pesables: la pantalla de
   * pedidos no los soporta todavía (ver pedido-proveedor.service.ts). */
  async stockBajoPorProveedor(organizationId: string, providerId: string) {
    const productos = await prisma.product.findMany({
      where: { organizationId, providerId, activo: true, esPesable: false },
      select: { id: true, sku: true, nombre: true, stock: true, stockMinimo: true },
    })
    return productos.filter((p) => p.stock <= p.stockMinimo)
  },

  /** Valor total del stock activo — a costo (lo que se pagó, "plata invertida
   * en estantería") y a precio de lista, para completar el panorama junto al
   * efectivo disponible (ver resumenService.reparto). Filtrable por proveedor
   * para mostrar el mismo desglose al configurar su piso de reinversión. */
  async valorInventario(organizationId: string, providerId?: string) {
    const productos = await prisma.product.findMany({
      where: { organizationId, activo: true, ...(providerId ? { providerId } : {}) },
      select: {
        stock: true, stockGramos: true, esPesable: true,
        precioCentavos: true, costoCentavos: true,
        precioPorKgCentavos: true, costoPorKgCentavos: true,
        variantOfId: true,
      },
    })
    let valorCostoCentavos = 0
    let valorVentaCentavos = 0
    for (const p of productos) {
      const v = valoresInventario(p)
      valorCostoCentavos += v.valorCostoCentavos
      valorVentaCentavos += v.valorVentaCentavos
    }
    return { valorCostoCentavos, valorVentaCentavos }
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

    const MAX_FILAS = 5000
    if (data.length > MAX_FILAS) {
      return {
        creados: 0,
        actualizados: 0,
        errores: [{ fila: 0, error: `El CSV tiene ${data.length} filas, el máximo permitido es ${MAX_FILAS}` }],
      }
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
