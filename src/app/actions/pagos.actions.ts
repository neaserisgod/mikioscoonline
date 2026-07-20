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

/** El external_reference de toda orden creada por enviarMontoMpAction es
 * "organizationId:uuid" (ver ahí) — permite confirmar que el orderId que
 * manda el cliente en consultarEstadoOrdenMpAction/cancelarOrdenMpAction
 * pertenece de verdad a su organización, sin lo cual cualquier usuario
 * autenticado podía consultar o cancelar la orden de otra organización
 * (ver docs/REPORTE-NUCLEO.md, hallazgo A1). */
function ordenPerteneceAOrganizacion(externalReference: string | undefined, organizationId: string): boolean {
  return !!externalReference && externalReference.startsWith(`${organizationId}:`)
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

  // organizationId codificado en external_reference (opaco para MP, no lo usa
  // para nada más) — le da contexto real al backstop de completarComisionReal
  // cuando detecta una orden paga sin ninguna venta local asociada (ver
  // mercadopago-comisiones.ts, docs/REPORTE-NUCLEO.md hallazgo C1).
  const externalReference = `${session.user.organizationId}:${crypto.randomUUID()}`

  try {
    if (medio.mpTerminalId) {
      const { orderId } = await getPagosProvider().enviarMontoAPosnet({
        terminalId: medio.mpTerminalId,
        montoCentavos,
        descripcion: "Venta kiosco",
        externalReference,
        expiracionMinutos: 16,
      })
      return { ok: true, orderId, tipo: "posnet" }
    }
    if (medio.mpExternalPosId) {
      const { orderId } = await getPagosProvider().enviarMontoAQr({
        externalPosId: medio.mpExternalPosId,
        montoCentavos,
        descripcion: "Venta kiosco",
        externalReference,
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
    const estado =
      tipo === "posnet"
        ? await getPagosProvider().consultarEstadoOrdenPosnet(orderId)
        : await getPagosProvider().consultarEstadoOrdenQr(orderId)
    if (!ordenPerteneceAOrganizacion(estado.externalReference, session.user.organizationId)) {
      return { ok: false, error: "No autorizado" }
    }
    return { ok: true, pagado: estado.pagado, finalizadoSinPago: estado.finalizadoSinPago }
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

  // Tanto QR como posnet pueden estar atados a una terminal Point real (no
  // solo posnet) — cancelar de verdad libera lo que esa terminal esté
  // mostrando en pantalla. Nunca relanzar: si MP ya expiró la orden sola,
  // cancelarla de nuevo tira error pero no hay nada más que hacer del lado
  // de la app.
  try {
    // Confirmar dueño ANTES de cancelar (no solo de consultar) — sin esto,
    // cualquier usuario autenticado podía cancelar la orden de otra
    // organización, colgando o liberando una terminal ajena (hallazgo A1).
    const estado =
      tipo === "posnet"
        ? await getPagosProvider().consultarEstadoOrdenPosnet(orderId)
        : await getPagosProvider().consultarEstadoOrdenQr(orderId)
    if (!ordenPerteneceAOrganizacion(estado.externalReference, session.user.organizationId)) {
      return { ok: false, error: "No autorizado" }
    }

    if (tipo === "posnet") {
      await getPagosProvider().cancelarOrdenPosnet(orderId)
    } else {
      await getPagosProvider().cancelarOrdenQr(orderId)
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: mensajeError(e) }
  }
}
