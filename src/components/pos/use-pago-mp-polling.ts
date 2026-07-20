"use client"

import { useEffect, useRef } from "react"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { crearVentaAction } from "@/app/actions/ventas.actions"
import { cancelarOrdenMpAction, consultarEstadoOrdenMpAction } from "@/app/actions/pagos.actions"
import { useVentasStore, type VentaAbierta } from "@/stores/ventas.store"
import { logError } from "@/lib/log"

// Primeros 30s tras iniciar un cobro: chequeo cada 1s (la mayoría de los pagos
// con QR/posnet entran en ese rango — bajar la latencia ahí es lo que más se
// nota). Pasado ese margen, cada 2.5s — ya no hay apuro, evita machacar la API
// de MercadoPago con un cobro que tarda en confirmarse.
const POLL_INTERVAL_MS_FAST = 1000
const POLL_INTERVAL_MS_SLOW = 2500
const VENTANA_RAPIDA_MS = 30_000
const TIMEOUT_MS = 5 * 60_000

const MENSAJE_SIN_PAGO: Record<"qr" | "posnet", string> = {
  qr: "el QR expiró sin pago",
  posnet: "el posnet se canceló sin pago",
}

/**
 * Procesa UN cobro de MercadoPago pendiente: chequea timeout/estado y, si
 * corresponde, crea la venta o cancela la orden. Exportada aparte de poll()
 * para poder testearla sin montar el hook completo (ver
 * tests/unit/use-pago-mp-polling.test.ts).
 *
 * Nunca lanza — cualquier error (red, timeout, lo que sea) queda atrapado,
 * logueado y avisado al cajero por toast, sin tocar el estado del cobro
 * pendiente, así el próximo ciclo de poll() lo reintenta solo. Antes, una
 * excepción acá abortaba el `for` de poll() entero y el `setTimeout` que
 * reprograma el próximo ciclo nunca se llegaba a llamar — el polling se
 * moría en silencio para TODOS los cobros pendientes de todas las pestañas
 * hasta recargar la página (ver docs/REPORTE-NUCLEO.md, hallazgo C4).
 */
export async function procesarCobroPendiente(venta: VentaAbierta, qc: QueryClient): Promise<void> {
  const pago = venta.pagoMpPendiente
  if (!pago) return
  const { confirmarPagoMp, cancelarPagoMp } = useVentasStore.getState()

  try {
    if (Date.now() - pago.iniciadoEn > TIMEOUT_MS) {
      await cancelarOrdenMpAction(pago.orderId, pago.tipo)
      cancelarPagoMp(venta.id)
      toast(`${venta.label}: ${MENSAJE_SIN_PAGO[pago.tipo]}`)
      return
    }

    const estado = await consultarEstadoOrdenMpAction(pago.orderId, pago.tipo)
    if (!estado.ok) return

    if (estado.finalizadoSinPago) {
      await cancelarOrdenMpAction(pago.orderId, pago.tipo)
      cancelarPagoMp(venta.id)
      toast(`${venta.label}: ${MENSAJE_SIN_PAGO[pago.tipo]}`)
      return
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
  } catch (error) {
    // No tocamos el estado del cobro pendiente: un error de red/timeout acá no
    // significa que el cobro se haya perdido — el próximo ciclo de poll() lo
    // reintenta solo. Avisamos igual para que el cajero note si se repite.
    logError("use-pago-mp-polling", error, { ventaId: venta.id, orderId: pago.orderId })
    toast.error(`${venta.label}: error consultando el pago, reintentando…`)
  }
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
    let detenido = false
    let timeoutId: ReturnType<typeof setTimeout>

    async function poll() {
      const { ventas } = useVentasStore.getState()
      const pendientes = ventas.filter((v) => v.pagoMpPendiente)

      for (const venta of pendientes) {
        if (enCurso.current.has(venta.id)) continue
        enCurso.current.add(venta.id)
        try {
          await procesarCobroPendiente(venta, qc)
        } finally {
          enCurso.current.delete(venta.id)
        }
      }

      if (detenido) return
      // Rápido mientras CUALQUIER cobro pendiente esté dentro de su propia
      // ventana de arranque (recién iniciado) — no relativo a cuándo se montó
      // este hook (que vive toda la sesión): cada cobro nuevo vuelve a arrancar
      // en modo rápido sin importar cuánto hace que el POS está abierto.
      const ahora = Date.now()
      const hayPagoReciente = pendientes.some(
        (v) => v.pagoMpPendiente && ahora - v.pagoMpPendiente.iniciadoEn < VENTANA_RAPIDA_MS
      )
      timeoutId = setTimeout(poll, hayPagoReciente ? POLL_INTERVAL_MS_FAST : POLL_INTERVAL_MS_SLOW)
    }

    poll() // primer chequeo inmediato — antes esperaba un intervalo entero (2.5s) sin hacer nada

    return () => {
      detenido = true
      clearTimeout(timeoutId)
    }
  }, [qc])

  // Avisa antes de recargar/cerrar la pestaña si hay algún cobro de MercadoPago
  // esperando confirmación. El estado ahora persiste en sessionStorage (ver
  // ventas.store.ts) así que un refresh accidental ya no pierde el cobro en
  // curso, pero seguir viendo el aviso evita el caso más común de todos: no
  // hace falta perder nada para que sea molesto tener que re-escanear/re-armar
  // el carrito si en realidad no hacía falta recargar.
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      const { ventas } = useVentasStore.getState()
      if (ventas.some((v) => v.pagoMpPendiente)) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [])
}
