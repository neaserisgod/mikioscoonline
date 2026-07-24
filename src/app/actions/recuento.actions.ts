"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { productoService } from "@/services/producto.service"
import { stockService } from "@/services/stock.service"
import { precioUnitarioEfectivo, costoUnitarioEfectivo, subtotalLinea } from "@/domain/pesables"
import { z } from "zod"

/**
 * Recuento de stock desde el celular (`/recuento`), contra esta misma DB
 * (Neon en producción — no hay canal separado, es la sesión web normal).
 * `guardarRecuentoLoteAction` deja una nota por producto en `RecuentoPendiente`
 * para que la caja la aplique a su stock local en el próximo sync (ver
 * aplicarRecuentosPendientes en scripts/lib/kiosco-sync.ts) — ese es el
 * invariante que evita que la próxima subida de la caja pise el conteo con su
 * stock local viejo.
 */

/** Productos de un proveedor para contar — sin categoría en el medio (ver árbol
 * proveedor → productos del recuento). `providerId` acepta el sentinel
 * "__sin_proveedor__" que ya usa productoService.listarFiltrado. */
export async function listarProductosRecuentoAction(providerId: string) {
  const session = await auth()
  if (!session?.user?.organizationId) throw new Error("No autorizado")

  const productos = await productoService.listarFiltrado(session.user.organizationId, { providerId })
  return productos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    sku: p.sku,
    esPesable: p.esPesable,
    stock: p.stock,
    stockGramos: p.stockGramos,
  }))
}

const ItemLoteSchema = z.object({
  productId: z.string().cuid(),
  cantidadContada: z.number().int().min(0),
  // Solo tiene efecto cuando hay faltante (sistema > contado): VENTA registra
  // el faltante como una venta liviana (ver crearVentaLigeraPorFaltante);
  // CONSUMO (o sin motivo) es solo la corrección de stock, sin plata de por
  // medio — mismo criterio que Sale.esConsumoInterno en el resto de la app.
  motivo: z.enum(["CONSUMO", "VENTA"]).optional(),
})
const LoteSchema = z.object({ items: z.array(ItemLoteSchema).min(1) })

type ResultadoItem = { productId: string; ok: boolean; error?: string }

/**
 * Registra el faltante de un producto como una venta — deliberadamente
 * LIVIANA, no reusa ventaService.crear: esto es una reconstrucción
 * retroactiva desde el celular, no una operación de POS en vivo.
 * - NO descuenta stock (ya lo corrige aplicarRecuentosPendientes/el AJUSTE de
 *   arriba en guardarRecuentoLoteAction — descontarlo acá también duplicaría
 *   la corrección).
 * - NO crea MovimientoCaja: no pasa por ninguna caja/sesión/arqueo.
 * - NO factura por AFIP ni imprime ticket (esos side-effects viven adentro de
 *   ventaService.crear, nunca se disparan solos por crear una Sale).
 * Usa el medio de pago default de la org (esDefault) para no tener que
 * pedirlo en la UI — el objetivo es simple: que el monto aparezca en los
 * reportes de rentabilidad/ventas por proveedor.
 */
async function crearVentaLigeraPorFaltante(params: {
  organizationId: string
  userId: string
  producto: {
    id: string
    esPesable: boolean
    precioCentavos: number
    costoCentavos: number
    precioPorKgCentavos: number | null
    costoPorKgCentavos: number | null
  }
  faltante: number // unidades, o gramos si esPesable
}) {
  const medioDefault = await prisma.paymentMethod.findFirst({
    where: { organizationId: params.organizationId, esDefault: true, activo: true },
  })
  if (!medioDefault) {
    throw new Error("No hay un medio de pago default configurado — no se pudo registrar la venta")
  }

  const precioUnitarioCentavos = precioUnitarioEfectivo(params.producto)
  const costoUnitarioCentavos = costoUnitarioEfectivo(params.producto)
  const gramos = params.producto.esPesable ? params.faltante : null
  const cantidad = params.producto.esPesable ? 1 : params.faltante

  const totalCentavos = subtotalLinea({
    esPesable: params.producto.esPesable, precioUnitarioCentavos, cantidad: params.faltante, gramos,
  })
  const costoTotalCentavos = subtotalLinea({
    esPesable: params.producto.esPesable, precioUnitarioCentavos: costoUnitarioCentavos, cantidad: params.faltante, gramos,
  })
  const comisionCentavos = Math.round((totalCentavos * medioDefault.comisionBp) / 10_000)

  await prisma.sale.create({
    data: {
      userId: params.userId,
      organizationId: params.organizationId,
      totalCentavos,
      costoTotalCentavos,
      lines: {
        create: [{ productId: params.producto.id, cantidad, gramos, precioUnitarioCentavos, costoUnitarioCentavos }],
      },
      payments: {
        create: [
          {
            paymentMethodId: medioDefault.id,
            montoCentavos: totalCentavos,
            comisionCentavos,
            montoNetoCentavos: totalCentavos - comisionCentavos,
          },
        ],
      },
    },
  })
}

/** Envía de una todos los productos contados de un proveedor. Cada item se
 * procesa en su propio try/catch — un producto que falle no debe tirar abajo
 * el resto del envío. */
export async function guardarRecuentoLoteAction(input: unknown): Promise<ResultadoItem[]> {
  const session = await auth()
  if (!session?.user?.id || !session.user.organizationId) throw new Error("No autorizado")
  // Mismo gate que ajusteStockAction (stock.actions.ts): un AJUSTE corrige el
  // stock de sistema, no debería quedar en manos de cualquier perfil.
  if (session.user.role !== "ADMIN") throw new Error("Solo ADMIN puede cargar recuentos")

  const { items } = LoteSchema.parse(input)
  const organizationId = session.user.organizationId
  const userId = session.user.id

  const resultados: ResultadoItem[] = []

  for (const item of items) {
    try {
      const producto = await prisma.product.findFirstOrThrow({ where: { id: item.productId, organizationId } })

      await prisma.recuentoPendiente.create({
        data: { organizationId, productId: item.productId, cantidadContada: item.cantidadContada, creadoPorUserId: userId },
      })

      const sistemaValor = producto.esPesable ? (producto.stockGramos ?? 0) : producto.stock
      const faltante = sistemaValor - item.cantidadContada

      // Best-effort: corrige el stock en Neon ya mismo (misma lógica atómica
      // de AJUSTE que usa el resto de la app) para que los reportes en la
      // nube muestren el valor contado sin esperar el sync de la caja. Si
      // esto falla no es grave: la nota ya quedó guardada arriba y la caja la
      // va a aplicar igual la próxima vez que sincronice.
      try {
        await stockService.registrarMovimiento({
          productId: item.productId,
          userId,
          organizationId,
          tipo: "AJUSTE",
          cantidad: item.cantidadContada,
          motivo: "Recuento online",
        })
      } catch (e) {
        console.error(`guardarRecuentoLoteAction: no se pudo corregir el stock en Neon para ${item.productId}`, e)
      }

      if (item.motivo === "VENTA" && faltante > 0) {
        await crearVentaLigeraPorFaltante({ organizationId, userId, producto, faltante })
      }

      resultados.push({ productId: item.productId, ok: true })
    } catch (e) {
      resultados.push({ productId: item.productId, ok: false, error: e instanceof Error ? e.message : "Error" })
    }
  }

  return resultados
}
