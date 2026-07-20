import { prisma } from "@/lib/prisma"
import { stockService } from "@/services/stock.service"
import { resolverTriangulo } from "@/domain/markup"
import { gananciaPotencial, resumenInventario } from "@/domain/pesables"
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
  /** Requerido solo si se manda `stock`/`stockGramos` (ver más abajo) — el
   * ajuste de stock queda auditado en StockMovement con este userId. */
  userId?: string
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
// `variantes` (Fase 2): siempre presente pero vacío en productos que no son
// dueños de nadie — el listado principal solo muestra dueños (variantOfId:
// null en el where de cada función de abajo), así que esto alcanza para que
// tanto la edición en Productos como el selector del POS tengan el precio de
// cada variante sin un fetch aparte.
const incluirRelaciones = {
  category: { select: { nombre: true } },
  provider: { select: { nombre: true } },
  location: { select: { nombre: true } },
  variantes: {
    where: { activo: true },
    select: { id: true, nombre: true, unidadesPorVenta: true, precioCentavos: true, costoCentavos: true, barcode: true, sku: true },
    orderBy: { unidadesPorVenta: "asc" as const },
  },
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

    const actualizado = await prisma.product.update({
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
        // NOTA: stock/stockGramos (cantidad actual) NUNCA se setean acá — ver
        // más abajo. stockMinimo/stockMinimoGramos son solo un umbral de
        // alerta, no la cantidad real, así que no tienen el mismo riesgo de
        // pisar una venta concurrente y se mantienen editables acá.
        ...(esPesable
          ? {
              ...(input.stockMinimoGramos !== undefined && { stockMinimoGramos: input.stockMinimoGramos }),
              ...(triangulo && {
                costoPorKgCentavos: triangulo.costoCentavos,
                precioPorKgCentavos: triangulo.precioCentavos,
                costoEsProvisional: triangulo.costoEsProvisional,
              }),
            }
          : {
              ...(input.stockMinimo !== undefined && { stockMinimo: input.stockMinimo }),
              ...(triangulo && {
                costoCentavos: triangulo.costoCentavos,
                precioCentavos: triangulo.precioCentavos,
                costoEsProvisional: triangulo.costoEsProvisional,
              }),
            }),
        // Al pasar de pesable a no-pesable, los campos pesable-only quedaban
        // con el último valor que tenían (sin efecto en la lógica de dominio,
        // que ya filtra por esPesable, pero confunden ante una inspección
        // directa de la fila). El camino inverso (no-pesable → pesable) no se
        // toca acá a propósito: limpiar `stock` entra en la misma zona
        // sensible que el hallazgo C2 (pisar stock sin pasar por
        // stockService), mejor no tocarlo en un cleanup de bajo riesgo.
        ...(input.esPesable === false && producto.esPesable === true
          ? { stockGramos: null, stockMinimoGramos: null, costoPorKgCentavos: null, precioPorKgCentavos: null }
          : {}),
      },
      // Sin include: el resultado no se usa (las actions devuelven solo {ok, error})
    })

    // Cambio explícito de stock actual (conteo físico): en vez de un SET directo
    // acá (que pisaba con el valor que tenía el formulario cuando se abrió,
    // revirtiendo silenciosamente cualquier venta ocurrida mientras tanto — ver
    // docs/REPORTE-NUCLEO.md, hallazgo C2), se enruta por
    // stockService.registrarMovimiento (AJUSTE): relee el stock actual DENTRO
    // de su propia transacción y deja un StockMovement auditado, igual que el
    // flujo dedicado de ajuste de stock. La action que llama a este service
    // (editarProductoAction) es quien exige rol ADMIN antes de dejar pasar
    // input.stock/stockGramos.
    if (esPesable && input.stockGramos !== undefined) {
      if (!input.userId) throw new Error("Falta userId para auditar el ajuste de stock")
      await stockService.registrarMovimiento({
        productId: input.id,
        userId: input.userId,
        organizationId: input.organizationId,
        tipo: "AJUSTE",
        cantidad: input.stockGramos,
        motivo: "Ajuste desde edición de producto",
      })
    } else if (!esPesable && input.stock !== undefined) {
      if (!input.userId) throw new Error("Falta userId para auditar el ajuste de stock")
      await stockService.registrarMovimiento({
        productId: input.id,
        userId: input.userId,
        organizationId: input.organizationId,
        tipo: "AJUSTE",
        cantidad: input.stock,
        motivo: "Ajuste desde edición de producto",
      })
    }

    return actualizado
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

  /** Listado principal — solo dueños (variantOfId: null). Las variantes se
   * ven/gestionan desde la edición de su dueño (ver `variantes` en
   * incluirRelaciones), no como filas sueltas acá. */
  async listar(organizationId: string) {
    return prisma.product.findMany({
      where: { organizationId, activo: true, variantOfId: null },
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

  /** Buscador del POS y de Productos — solo dueños (ver `listar`). Una variante
   * nunca aparece como fila propia acá: se llega a ella eligiéndola en el
   * selector del dueño (POS) o escaneando su código de barras directo
   * (buscarPorCodigo, sin este filtro — ver use-barcode-handler.ts). */
  async buscar(organizationId: string, query: string) {
    // Filtro en JS (no `mode: "insensitive"`, exclusivo del conector Postgres/MongoDB
    // de Prisma) para funcionar igual en SQLite y Postgres. El catálogo es chico
    // (cientos de productos por organización), así que traer todo y filtrar acá
    // es instantáneo y evita depender de una feature específica del motor.
    const q = normalizarTexto(query)
    const productos = await prisma.product.findMany({
      where: { organizationId, activo: true, variantOfId: null },
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
    // Se trae un buffer de `limit × 5` productId distintos: varias filas se
    // van a fusionar bajo un mismo dueño al resolver variantes (ver abajo),
    // así que hay que rankear sobre un universo más grande que `limit` para
    // no perder un dueño que solo vendió a través de sus variantes.
    const ranking = await prisma.saleLine.groupBy({
      by: ["productId"],
      where: { sale: { organizationId, fecha: { gte: desde }, esConsumoInterno: false } },
      _count: { productId: true },
      orderBy: { _count: { productId: "desc" } },
      take: limit * 5,
    })
    if (ranking.length === 0) return []

    // El ranking cuenta por productId real de la línea (variantes incluidas),
    // pero el acceso rápido del POS solo muestra dueños (ver `buscar`) — se
    // resuelve cada productId a su dueño (variantOfId ?? id, mismo criterio
    // que rentabilidadService.porAgrupador) y se fusionan los conteos, para
    // que el dueño aparezca en el ranking aunque solo se haya vendido a
    // través de sus variantes.
    const productosRankeados = await prisma.product.findMany({
      where: { id: { in: ranking.map((r) => r.productId) }, organizationId },
      select: { id: true, variantOfId: true },
    })
    const dueñoPorId = new Map(productosRankeados.map((p) => [p.id, p.variantOfId ?? p.id]))

    const conteoPorDueño = new Map<string, number>()
    for (const r of ranking) {
      const dueñoId = dueñoPorId.get(r.productId) ?? r.productId
      conteoPorDueño.set(dueñoId, (conteoPorDueño.get(dueñoId) ?? 0) + r._count.productId)
    }
    const topDueños = Array.from(conteoPorDueño.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id)

    const productos = await prisma.product.findMany({
      where: { id: { in: topDueños }, organizationId, activo: true, variantOfId: null },
      include: incluirRelaciones,
    })
    const porId = new Map(productos.map((p) => [p.id, p]))
    return topDueños.map((id) => porId.get(id)).filter((p) => p !== undefined)
  },

  async buscarPorCodigo(barcode: string, organizationId: string) {
    return prisma.product.findFirst({
      where: { barcode, organizationId, activo: true },
      include: incluirRelaciones,
    })
  },

  /** Cards de nivel 1 en Productos (Proveedores) y base del desglose
   * financiero por proveedor (ver proveedores-client.tsx). Arranca de TODOS
   * los proveedores activos (no solo los que tienen productos) para que uno
   * recién creado, o uno que se quedó sin stock, aparezca igual con todo en
   * $0 en vez de desaparecer de la lista. "Sin proveedor" sigue siendo un
   * bucket sintético (no es un Provider real) — mismo sentinel que ya usa
   * rentabilidad.service.ts, solo aparece si hay productos sueltos. */
  async resumenProveedores(organizationId: string) {
    const [proveedores, productos] = await Promise.all([
      prisma.provider.findMany({
        where: { organizationId, activo: true },
        select: { id: true, nombre: true, pisoReposicionCentavos: true, saldoReposicionCentavos: true },
      }),
      // Solo dueños (ver `listar`) — el stock/valor de una variante ya está
      // contado en su dueño, sumarla aparte duplicaría el conteo.
      prisma.product.findMany({
        where: { organizationId, activo: true, variantOfId: null },
        select: {
          providerId: true,
          stock: true,
          stockGramos: true,
          esPesable: true,
          precioCentavos: true,
          costoCentavos: true,
          precioPorKgCentavos: true,
          costoPorKgCentavos: true,
        },
      }),
    ])

    const productosPorProveedor = new Map<string, typeof productos>()
    for (const p of productos) {
      const id = p.providerId ?? "__sin_proveedor__"
      const lista = productosPorProveedor.get(id)
      if (lista) lista.push(p)
      else productosPorProveedor.set(id, [p])
    }

    function fila(id: string, nombre: string, pisoReposicionCentavos: number, saldoReposicionCentavos: number) {
      const productosDeEste = productosPorProveedor.get(id) ?? []
      const sinStock = productosDeEste.filter((p) => (p.esPesable ? (p.stockGramos ?? 0) === 0 : p.stock === 0)).length
      const { valorCostoCentavos, valorVentaCentavos, gananciaPotencialCentavos } = resumenInventario(productosDeEste)
      return {
        id, nombre, totalProductos: productosDeEste.length, sinStock,
        gananciaPotencialCentavos, valorCostoCentavos, valorVentaCentavos,
        pisoReposicionCentavos, saldoReposicionCentavos,
      }
    }

    const filas = proveedores.map((p) => fila(p.id, p.nombre, p.pisoReposicionCentavos, p.saldoReposicionCentavos))
    if (productosPorProveedor.has("__sin_proveedor__")) {
      filas.push(fila("__sin_proveedor__", "Sin proveedor", 0, 0))
    }

    return filas.sort((a, b) => a.nombre.localeCompare(b.nombre))
  },

  /** Cards de nivel 2 en Productos (Categorías dentro de un proveedor).
   * `providerId: null` = bucket "Sin proveedor" del nivel 1. */
  async resumenCategorias(organizationId: string, providerId: string | null) {
    // Solo dueños (ver resumenProveedores) — mismo motivo: evitar doble conteo.
    const productos = await prisma.product.findMany({
      where: { organizationId, activo: true, providerId, variantOfId: null },
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
        variantOfId: null,
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
    // Prisma no soporta comparar dos columnas en where → raw query. Solo
    // dueños: el stock real vive ahí (ver `listar`), una variante siempre
    // tiene su propia columna `stock` en 0/irrelevante.
    return prisma.$queryRaw<
      Array<{ id: string; sku: string; nombre: string; stock: number; stockMinimo: number }>
    >`
      SELECT id, sku, nombre, stock, "stockMinimo"
      FROM "Product"
      WHERE "organizationId" = ${organizationId}
        AND activo = true
        AND "variantOfId" IS NULL
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
      where: { organizationId, providerId, activo: true, esPesable: false, variantOfId: null },
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
    const { valorCostoCentavos, valorVentaCentavos } = resumenInventario(productos)
    return { valorCostoCentavos, valorVentaCentavos }
  },

  async desactivar(id: string, organizationId: string) {
    const producto = await prisma.product.findFirstOrThrow({ where: { id, organizationId } })
    // Si es dueño (variantOfId null), sus variantes quedarían huérfanas y
    // seguirían apareciendo activas en la edición de un dueño ya desactivado
    // — se desactivan en cascada. Una variante no tiene variantes propias
    // (ver validarVariante), así que no hay que recursar más de un nivel.
    if (producto.variantOfId === null) {
      return prisma.$transaction(async (tx) => {
        await tx.product.updateMany({ where: { variantOfId: id }, data: { activo: false } })
        return tx.product.update({ where: { id }, data: { activo: false } })
      })
    }
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

        // Cada fila en su propia transacción: category/provider/location upsert +
        // create/update del producto son todo-o-nada para ESTA fila. Antes, un
        // crash (o una excepción de resolverTriangulo) a mitad de fila podía
        // dejar, por ejemplo, una categoría nueva ya creada sin ningún producto
        // usándola. No se envuelve el CSV entero en una sola transacción a
        // propósito: filas son independientes por diseño (best-effort, ver
        // errores[] más abajo) y una transacción de hasta 5000 filas retendría
        // el lock/conexión demasiado tiempo, además de que un error real de DB
        // en la fila N dejaría la transacción "abortada" para las filas N+1..
        // (ver docs/REPORTE-NUCLEO.md, hallazgo M5).
        const resultado = await prisma.$transaction(async (tx) => {
          const category = await tx.category.upsert({
            where: { nombre_organizationId: { nombre: row.categoria, organizationId } },
            create: { nombre: row.categoria, markupDefaultBp: 5000, organizationId },
            update: {},
          })

          const provider = row.proveedor
            ? await tx.provider.upsert({
                where: { nombre_organizationId: { nombre: row.proveedor, organizationId } },
                create: { nombre: row.proveedor, organizationId },
                update: {},
              })
            : null

          const location = row.heladera
            ? await tx.location.upsert({
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

          const existing = await tx.product.findFirst({
            where: { sku: row.sku, organizationId },
          })

          if (existing) {
            await tx.product.update({
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
            return "actualizado" as const
          }

          await tx.product.create({
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
          return "creado" as const
        })

        if (resultado === "actualizado") actualizados++
        else creados++
      } catch (e) {
        errores.push({ fila, error: e instanceof Error ? e.message : String(e) })
      }
    }

    return { creados, actualizados, errores }
  },
}
