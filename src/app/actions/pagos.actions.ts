"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getPagosProvider } from "@/lib/providers/pagos"

export type TipoDispositivoMp = "qr" | "posnet"

type EnviarMontoMpResult =
  | { ok: true; orderId: string; tipo: TipoDispositivoMp }
  | { ok: false; error: string }
type ConsultarEstadoResult =
  | { ok: true; pagado: boolean; finalizadoSinPago: boolean }
  | { ok: false; error: string }
type CancelarResult = { ok: true } | { ok: false; error: string }

function mensajeError(e: unknown): string {
  if (e instanceof Error) return e.message
  return "No se pudo comunicar con MercadoPago"
}

export async function enviarMontoMpAction(
  paymentMethodId: string,
  montoCentavos: number
): Promise<EnviarMontoMpResult> {
  const session = await auth()
  if (!session?.user?.organizationId) return { ok: false, error: "No autorizado" }

  const medio = await prisma.paymentMethod.findFirst({
    where: { id: paymentMethodId, organizationId: session.user.organizationId },
  })
  if (!medio?.esMercadoPago) {
    return { ok: false, error: "Este medio de pago no es de MercadoPago" }
  }

  try {
    if (medio.mpTerminalId) {
      const { orderId } = await getPagosProvider().enviarMontoAPosnet({
        terminalId: medio.mpTerminalId,
        montoCentavos,
        descripcion: "Venta kiosco",
        externalReference: crypto.randomUUID(),
        expiracionMinutos: 16,
      })
      return { ok: true, orderId, tipo: "posnet" }
    }
    if (medio.mpExternalPosId) {
      const { orderId } = await getPagosProvider().enviarMontoAQr({
        externalPosId: medio.mpExternalPosId,
        montoCentavos,
        descripcion: "Venta kiosco",
        externalReference: crypto.randomUUID(),
        expiracionMinutos: 5,
      })
      return { ok: true, orderId, tipo: "qr" }
    }
    return { ok: false, error: "Este medio de pago no tiene QR ni posnet configurado" }
  } catch (e) {
    return { ok: false, error: mensajeError(e) }
  }
}

export async function consultarEstadoOrdenMpAction(
  orderId: string,
  tipo: TipoDispositivoMp
): Promise<ConsultarEstadoResult> {
  const session = await auth()
  if (!session?.user?.organizationId) return { ok: false, error: "No autorizado" }

  try {
    const { pagado, finalizadoSinPago } =
      tipo === "posnet"
        ? await getPagosProvider().consultarEstadoOrdenPosnet(orderId)
        : await getPagosProvider().consultarEstadoOrdenQr(orderId)
    return { ok: true, pagado, finalizadoSinPago }
  } catch (e) {
    return { ok: false, error: mensajeError(e) }
  }
}

export async function cancelarOrdenMpAction(
  orderId: string,
  tipo: TipoDispositivoMp
): Promise<CancelarResult> {
  const session = await auth()
  if (!session?.user?.organizationId) return { ok: false, error: "No autorizado" }

  // El QR no necesita cancelación real: nada queda pendiente del lado de MercadoPago.
  // El posnet sí — la terminal física queda esperando la tarjeta hasta cancelar.
  if (tipo !== "posnet") return { ok: true }

  try {
    await getPagosProvider().cancelarOrdenPosnet(orderId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: mensajeError(e) }
  }
}
