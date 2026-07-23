"use server"

import { auth } from "@/auth"
import { ventaService } from "@/services/venta.service"
import { Prisma } from "@prisma/client"
import { z, ZodError } from "zod"
import { logError } from "@/lib/log"

const LineaSchema = z.object({
  productId: z.string().cuid(),
  cantidad: z.number().int().positive(),
  // Solo productos pesables: gramos vendidos (0 se rechaza con mensaje claro en venta.service)
  gramos: z.number().int().min(0).optional(),
})

const PagoSchema = z.object({
  paymentMethodId: z.string().cuid(),
  // min(0), no positive(): un consumo interno cobra $0 (ver esConsumoInterno).
  montoCentavos: z.number().int().min(0),
  referencia: z.string().optional(),
})

const CrearVentaSchema = z.object({
  // Id determinístico opcional (ver use-pago-mp-polling.ts y
  // mercadopago-comisiones.ts, hallazgo C1 residual): si dos caminos piden
  // crear la "misma" venta con el mismo id, ventaService.crear es idempotente
  // (P2002) y devuelve la ya creada en vez de duplicar.
  // 128, no 64: el orderId real de MercadoPago es corto, pero MockPagosProvider
  // (ver src/lib/providers/pagos/mock.ts) codifica a propósito el
  // externalReference + timestamp DENTRO del orderId (no tiene estado compartido
  // entre llamadas), y con eso "mp-<orderId>" supera los 64 — rechazaba con
  // "Invalid input" toda venta simulada por QR/posnet en dev/testing sin
  // credenciales reales de MP cargadas.
  id: z.string().min(8).max(128).optional(),
  lineas: z.array(LineaSchema).min(1, "La venta debe tener al menos una línea"),
  // min(0), no min(1): una venta 100% fiada a un cliente (ver fiadoCentavos)
  // puede no tener ningún pago real.
  pagos: z.array(PagoSchema),
  descuentoCentavos: z.number().int().min(0).optional(),
  /** Consumo de personal o del dueño — no es una venta real a un cliente. */
  esConsumoInterno: z.boolean().optional(),
  /** Cuenta corriente: resto que queda fiado a un cliente en vez de cobrado. */
  fiadoCentavos: z.number().int().min(0).optional(),
  customerId: z.string().cuid().optional(),
})

// Devolvemos el error como dato (no lo lanzamos) para que el mensaje real llegue al
// cliente. Next.js enmascara los errores LANZADOS en producción ("digest"), pero los
// valores devueltos pasan tal cual — mismo patrón que productos.actions.ts.
type CrearVentaResult = { ok: true; id: string } | { ok: false; error: string }

function mensajeError(e: unknown): string {
  if (e instanceof ZodError) {
    return e.issues.map((i) => i.message).join(" · ")
  }
  // No devolver el mensaje nativo de Prisma al cliente — filtra nombres de
  // columnas/tablas internas. Los errores de negocio (stock insuficiente, caja
  // cerrada, etc.) son `new Error(...)` planos, no Prisma, y siguen pasando abajo.
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return "No se pudo registrar la venta (error de base de datos)"
  }
  if (e instanceof Error) return e.message
  return "No se pudo registrar la venta"
}

export async function crearVentaAction(input: unknown): Promise<CrearVentaResult> {
  try {
    const session = await auth()
    if (!session?.user?.id || !session.user.organizationId) return { ok: false, error: "No autorizado" }

    const { id, lineas, pagos, descuentoCentavos, esConsumoInterno, fiadoCentavos, customerId } = CrearVentaSchema.parse(input)

    const venta = await ventaService.crear({
      id,
      userId: session.user.id,
      organizationId: session.user.organizationId,
      lineas,
      pagos,
      descuentoCentavos,
      esConsumoInterno,
      fiadoCentavos,
      customerId,
    })
    return { ok: true, id: venta.id }
  } catch (e) {
    // Un ZodError acá casi siempre significa un pago de MercadoPago ya
    // confirmado que no se pudo convertir en venta (ver use-pago-mp-polling.ts)
    // — el mensaje que ve el cajero es genérico ("Invalid input"), así que sin
    // esto no queda ningún rastro de qué campo/valor exacto rechazó el schema.
    if (e instanceof ZodError) {
      logError("crearVentaAction", e, { issues: e.issues, input })
    }
    return { ok: false, error: mensajeError(e) }
  }
}

type ConfirmarTraspasoResult = { ok: true } | { ok: false; error: string }

export async function confirmarTraspasoCigarrillosAction(saleId: string): Promise<ConfirmarTraspasoResult> {
  try {
    const session = await auth()
    if (!session?.user?.id || !session.user.organizationId) return { ok: false, error: "No autorizado" }

    await ventaService.confirmarTraspasoCigarrillos(saleId, session.user.organizationId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: mensajeError(e) }
  }
}
