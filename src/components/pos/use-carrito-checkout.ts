"use client"

import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { calcularRecargo } from "@/domain/comisiones"
import { subtotalLinea } from "@/domain/pesables"
import { crearVentaAction } from "@/app/actions/ventas.actions"
import { cancelarOrdenMpAction, enviarMontoMpAction } from "@/app/actions/pagos.actions"
import { useVentasStore, useVentaActiva } from "@/stores/ventas.store"

export interface MedioPago {
  id: string
  nombre: string
  comisionBp: number
  esMercadoPago: boolean
  esEfectivo: boolean
  recargoTipo: string
  recargoVirtualBp: number
  recargoVirtualFijoCentavos: number
}

/**
 * Estado y lógica de checkout compartidos entre el layout de /vender (lista
 * de productos a la izquierda, resumen de cobro a la derecha) y la venta
 * rápida en overlay (todo apilado en una columna).
 */
export function useCarritoCheckout(onSuccess?: (ventaId: string) => void) {
  const qc = useQueryClient()
  const venta = useVentaActiva()
  const {
    cambiarCantidad, setGramos, eliminarLinea, vaciarCarrito, setMedioPago, onVentaConfirmada,
    iniciarPagoMp, cancelarPagoMp,
  } = useVentasStore()
  const [loading, setLoading] = useState(false)
  const [confirmVaciar, setConfirmVaciar] = useState(false)
  const [successInfo, setSuccessInfo] = useState<{
    ventaId: string
    totalCentavos: number
    nombreMedioPago: string
  } | null>(null)

  const { data: mediosPago } = useQuery<MedioPago[]>({
    queryKey: ["medios-pago"],
    queryFn: () => fetch("/api/config/medios-pago").then((r) => r.json()),
    staleTime: 5 * 60_000,
  })

  const medioPagoId = venta?.medioPagoId ?? ""

  // Auto-select the default payment method when options load and none is selected
  useEffect(() => {
    if (mediosPago?.length && venta && !venta.medioPagoId) {
      const def = mediosPago.find((m) => m.esEfectivo) ?? mediosPago[0]
      setMedioPago(def.id)
    }
  }, [mediosPago, venta?.id, venta?.medioPagoId, setMedioPago])

  const carrito = venta?.carrito ?? []

  // Si el carrito quedó vacío (vaciado, venta confirmada, etc.), descartar
  // cualquier confirmación pendiente en vez de dejarla colgada para la próxima carga.
  if (carrito.length === 0 && confirmVaciar) setConfirmVaciar(false)

  const subtotal = (l: (typeof carrito)[number]) =>
    subtotalLinea({ esPesable: l.esPesable, precioUnitarioCentavos: l.precioUnitarioCentavos, cantidad: l.cantidad, gramos: l.gramos })
  const totalCentavos = carrito.reduce((s, l) => s + subtotal(l), 0)
  const medioPagoSeleccionado = mediosPago?.find((m) => m.id === medioPagoId)
  const comisionCentavos = medioPagoSeleccionado
    ? Math.round((totalCentavos * medioPagoSeleccionado.comisionBp) / 10_000)
    : 0
  const faltaPeso = carrito.some((l) => l.esPesable && (l.gramos ?? 0) <= 0)

  // Recargo virtual por pago no-efectivo — se configura por medio de pago (Config > Medios de pago)
  const recargoTotalCentavos =
    medioPagoSeleccionado && !medioPagoSeleccionado.esEfectivo
      ? calcularRecargo(medioPagoSeleccionado, totalCentavos)
      : 0
  const totalACobrarCentavos = totalCentavos + recargoTotalCentavos

  async function confirmar() {
    if (!medioPagoId) { toast.error("Seleccioná un medio de pago"); return }
    if (carrito.length === 0) return
    if (faltaPeso) { toast.error("Cargá el peso de todos los productos pesables"); return }
    if (!venta) return

    // Cobro con MercadoPago (QR o posnet): no se registra la venta todavía — se manda
    // el monto al dispositivo y se espera la confirmación real del pago (ver
    // use-pago-mp-polling.ts, que corre en background y recién ahí crea la venta).
    if (medioPagoSeleccionado?.esMercadoPago) {
      setLoading(true)
      try {
        const result = await enviarMontoMpAction(medioPagoId, totalACobrarCentavos)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        iniciarPagoMp(venta.id, {
          tipo: result.tipo,
          orderId: result.orderId,
          montoCentavos: totalACobrarCentavos,
          iniciadoEn: Date.now(),
        })
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo enviar el monto a MercadoPago")
      } finally {
        setLoading(false)
      }
      return
    }

    setLoading(true)
    try {
      const result = await crearVentaAction({
        lineas: carrito.map((l) => ({
          productId: l.productId,
          cantidad: l.cantidad,
          ...(l.esPesable && { gramos: l.gramos ?? 0 }),
        })),
        pagos: [{ paymentMethodId: medioPagoId, montoCentavos: totalACobrarCentavos }],
      })

      if (!result.ok) {
        // Mensaje específico para sobreventa entre carritos paralelos
        if (result.error.toLowerCase().includes("stock")) {
          toast.error("Stock insuficiente — otro carrito ya reservó esas unidades")
        } else {
          toast.error(result.error)
        }
        return
      }

      setSuccessInfo({
        ventaId: result.id,
        totalCentavos: totalACobrarCentavos,
        nombreMedioPago: medioPagoSeleccionado?.nombre ?? "",
      })
      onVentaConfirmada()
      qc.invalidateQueries({ queryKey: ["resumen"] })
      qc.invalidateQueries({ queryKey: ["productos"] })
      qc.invalidateQueries({ queryKey: ["cajas-panel"] })
      onSuccess?.(result.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al registrar la venta")
    } finally {
      setLoading(false)
    }
  }

  return {
    venta, carrito, medioPagoId, mediosPago, medioPagoSeleccionado,
    subtotal, totalCentavos, comisionCentavos, recargoTotalCentavos, totalACobrarCentavos, faltaPeso,
    loading, successInfo, setSuccessInfo, confirmVaciar, setConfirmVaciar,
    cambiarCantidad, setGramos, eliminarLinea, vaciarCarrito, setMedioPago,
    confirmar,
    cancelarPagoMp: async () => {
      if (!venta?.pagoMpPendiente) return
      await cancelarOrdenMpAction(venta.pagoMpPendiente.orderId, venta.pagoMpPendiente.tipo)
      cancelarPagoMp(venta.id)
    },
  }
}

export type CarritoCheckout = ReturnType<typeof useCarritoCheckout>
