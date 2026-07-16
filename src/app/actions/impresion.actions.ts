"use server"

import { auth } from "@/auth"
import { impresionService } from "@/services/impresion.service"

type DescargarTicketPruebaResult =
  | { ok: true; pdfBase64: string; posnetEstado: "enviado" | "sin_terminal" | "error" }
  | { ok: false; error: string }

/**
 * Botón de prueba en Configuración — arma un ticket NO fiscal con datos
 * REALES del negocio (nombre/CUIT/condición IVA) pero ítems inventados. No
 * crea ninguna venta ni escribe nada en la base y no llama a AFIP: genera el
 * PDF (para que la UI lo baje directo) y, si hay un posnet configurado,
 * SIEMPRE intenta imprimirlo ahí también — sin importar el toggle
 * Organization.imprimirTicketPosnet (que solo gobierna el auto-print de cada
 * venta real, ver impresionService.procesarTicketVenta). Solo ADMIN.
 */
export async function descargarTicketPruebaAction(): Promise<DescargarTicketPruebaResult> {
  try {
    const session = await auth()
    if (!session?.user?.organizationId) return { ok: false, error: "No autorizado" }
    if (session.user.role !== "ADMIN") return { ok: false, error: "Solo ADMIN puede usar la impresión de prueba" }

    const { pdfBase64, posnetEstado } = await impresionService.generarTicketPrueba(session.user.organizationId)
    return { ok: true, pdfBase64, posnetEstado }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo generar el ticket de prueba" }
  }
}
