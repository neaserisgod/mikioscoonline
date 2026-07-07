"use client"

import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { crearVentaAction } from "@/app/actions/ventas.actions"
import { cancelarOrdenMpAction, consultarEstadoOrdenMpAction } from "@/app/actions/pagos.actions"
import { useVentasStore } from "@/stores/ventas.store"

const POLL_INTERVAL_MS = 2500
const TIMEOUT_MS = 5 * 60_000

const MENSAJE_SIN_PAGO: Record<"qr" | "posnet", string> = {
  qr: "el QR expiró sin pago",
  posnet: "el posnet se canceló sin pago",
}

/**
 * Corre en background sin importar qué pestaña de venta esté activa: revisa
 * el estado de cada cobro con MercadoPago (QR o posnet) pendiente y recién
 * cuando MercadoPago confirma el pago crea la venta real (stock, caja,
 * Payment.referencia). Si expira o se cancela, no queda nada persistido —
 * nunca se creó ninguna venta. Para posnet, además, cancela la orden en
 * MercadoPago antes de limpiar el estado local, para liberar la terminal
 * física (que si no queda esperando la tarjeta indefinidamente).
 */
export function usePagoMpPolling() {
  const qc = useQueryClient()
  // Evita relanzar un poll para la misma venta mientras el anterior sigue en vuelo.
  const enCurso = useRef<Set<string>>(new Set())

  useEffect(() => {
    const interval = setInterval(async () => {
      const { ventas, confirmarPagoMp, cancelarPagoMp } = useVentasStore.getState()
      const pendientes = ventas.filter((v) => v.pagoMpPendiente)

      for (const venta of pendientes) {
        if (enCurso.current.has(venta.id)) continue
        const pago = venta.pagoMpPendiente
        if (!pago) continue
        enCurso.current.add(venta.id)

        try {
          if (Date.now() - pago.iniciadoEn > TIMEOUT_MS) {
            await cancelarOrdenMpAction(pago.orderId, pago.tipo)
            cancelarPagoMp(venta.id)
            toast(`${venta.label}: ${MENSAJE_SIN_PAGO[pago.tipo]}`)
            continue
          }

          const estado = await consultarEstadoOrdenMpAction(pago.orderId, pago.tipo)
          if (!estado.ok) continue

          if (estado.finalizadoSinPago) {
            await cancelarOrdenMpAction(pago.orderId, pago.tipo)
            cancelarPagoMp(venta.id)
            toast(`${venta.label}: ${MENSAJE_SIN_PAGO[pago.tipo]}`)
            continue
          }

          if (estado.pagado) {
            const result = await crearVentaAction({
              lineas: venta.carrito.map((l) => ({
                productId: l.productId,
                cantidad: l.cantidad,
                ...(l.esPesable && { gramos: l.gramos ?? 0 }),
              })),
              pagos: [
                {
                  paymentMethodId: venta.medioPagoId,
                  montoCentavos: pago.montoCentavos,
                  referencia: pago.orderId,
                },
              ],
              descuentoCentavos: pago.descuentoCentavos,
            })

            if (result.ok) {
              confirmarPagoMp(venta.id)
              toast.success(`${venta.label} — pago confirmado`)
              qc.invalidateQueries({ queryKey: ["resumen"] })
              qc.invalidateQueries({ queryKey: ["productos"] })
              qc.invalidateQueries({ queryKey: ["cajas-panel"] })
            } else {
              // El cliente ya pagó en MercadoPago pero la venta no se pudo registrar acá
              // (ej. se quedó sin stock mientras esperaba) — el pago ya está confirmado
              // del lado de MP, así que seguir esperando no cambia nada: requiere
              // revisión manual del cajero/admin.
              cancelarPagoMp(venta.id)
              toast.error(
                `${venta.label}: el cliente pagó pero no se pudo registrar la venta (${result.error}) — revisar manualmente`
              )
            }
          }
        } finally {
          enCurso.current.delete(venta.id)
        }
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [qc])
}
