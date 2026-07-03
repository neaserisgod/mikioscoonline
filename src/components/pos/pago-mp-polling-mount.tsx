"use client"

import { usePagoMpPolling } from "./use-pago-mp-polling"

/** Componente sin UI — monta el polling de cobros con MercadoPago (QR/posnet) pendientes en el layout. */
export function PagoMpPollingMount() {
  usePagoMpPolling()
  return null
}
