"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { productoService } from "@/services/producto.service"
import { stockService } from "@/services/stock.service"
import { z } from "zod"

/**
 * Recuento de stock desde el celular (`/recuento`), contra esta misma DB
 * (Neon en producción — no hay canal separado, es la sesión web normal).
 * `guardarRecuentoAction` deja la nota en `RecuentoPendiente` para que la caja
 * la aplique a su stock local en el próximo sync (ver aplicarRecuentosPendientes
 * en scripts/lib/kiosco-sync.ts) — ese es el invariante que evita que la
 * próxima subida de la caja pise el conteo con su stock local viejo.
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

const RecuentoSchema = z.object({
  productId: z.string().cuid(),
  cantidadContada: z.number().int().min(0),
  nota: z.string().optional(),
})

export async function guardarRecuentoAction(input: unknown) {
  const session = await auth()
  if (!session?.user?.id || !session.user.organizationId) throw new Error("No autorizado")
  // Mismo gate que ajusteStockAction (stock.actions.ts): un AJUSTE corrige el
  // stock de sistema, no debería quedar en manos de cualquier perfil.
  if (session.user.role !== "ADMIN") throw new Error("Solo ADMIN puede cargar recuentos")

  const { productId, cantidadContada, nota } = RecuentoSchema.parse(input)
  const organizationId = session.user.organizationId

  await prisma.product.findFirstOrThrow({ where: { id: productId, organizationId } })

  const notaGuardada = await prisma.recuentoPendiente.create({
    data: { organizationId, productId, cantidadContada, nota, creadoPorUserId: session.user.id },
  })

  // Best-effort: corrige el stock en Neon ya mismo (reusa la misma lógica
  // atómica de AJUSTE — set absoluto, soporta pesables/variantes) para que los
  // reportes en la nube muestren el valor contado sin esperar el sync de la
  // caja. Si esto falla no es grave: la nota ya quedó guardada y la caja la va
  // a aplicar igual la próxima vez que sincronice.
  try {
    await stockService.registrarMovimiento({
      productId,
      userId: session.user.id,
      organizationId,
      tipo: "AJUSTE",
      cantidad: cantidadContada,
      motivo: "Recuento online",
    })
  } catch (e) {
    console.error("guardarRecuentoAction: no se pudo corregir el stock en Neon en el momento", e)
  }

  return notaGuardada
}
