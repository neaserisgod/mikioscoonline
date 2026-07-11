"use client"

import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { calcularRecargoCigarrillos } from "@/domain/recargo-cigarrillos"
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
    cambiarCantidad, setGramos, eliminarLinea, vaciarCarrito, setMedioPago, setDescuentoPct, setConsumoInterno,
    onVentaConfirmada, iniciarPagoMp, cancelarPagoMp,
  } = useVentasStore()
  const [loading, setLoading] = useState(false)
  const [confirmVaciar, setConfirmVaciar] = useState(false)
  const [manualDialogOpen, setManualDialogOpen] = useState(false)
  const [manualLoading, setManualLoading] = useState(false)
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
  const faltaPeso = carrito.some((l) => l.esPesable && (l.gramos ?? 0) <= 0)

  // Descuento manual del cajero — % libre sobre el subtotal de productos, elegido en el
  // panel de checkout. Todo lo que sigue (recargo, comisión estimada, total a cobrar) se
  // calcula sobre el monto YA descontado, no sobre el precio de lista.
  const descuentoPct = venta?.descuentoPct ?? 0
  const descuentoCentavos = Math.round((totalCentavos * descuentoPct) / 100)
  const totalConDescuentoCentavos = totalCentavos - descuentoCentavos
  const esConsumoInterno = venta?.esConsumoInterno ?? false

  const comisionCentavos = medioPagoSeleccionado
    ? Math.round((totalConDescuentoCentavos * medioPagoSeleccionado.comisionBp) / 10_000)
    : 0

  // Recargo por cigarrillos pagados con QR/Posnet — escalonado por cantidad (atados/sueltos),
  // no por % ni fijo del medio de pago (ver domain/recargo-cigarrillos.ts). No aplica a
  // consumo interno: no es una venta real, no hay nada que trasladar al proveedor.
  const recargoTotalCentavos = medioPagoSeleccionado?.esMercadoPago && !esConsumoInterno
    ? calcularRecargoCigarrillos(carrito)
    : 0
  const totalACobrarCentavos = totalConDescuentoCentavos + recargoTotalCentavos

  async function confirmar() {
    if (!medioPagoId) { toast.error("Seleccioná un medio de pago"); return }
    if (carrito.length === 0) return
    if (faltaPeso) { toast.error("Cargá el peso de todos los productos pesables"); return }
    if (!venta) return

    // Cobro con MercadoPago (QR o posnet): no se registra la venta todavía — se manda
    // el monto al dispositivo y se espera la confirmación real del pago (ver
    // use-pago-mp-polling.ts, que corre en background y recién ahí crea la venta).
    // Consumo interno nunca pasa por acá aunque el medio elegido sea QR/Posnet: es
    // $0, no tiene sentido mandarlo al dispositivo.
    if (medioPagoSeleccionado?.esMercadoPago && !esConsumoInterno) {
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
          descuentoCentavos,
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
        descuentoCentavos,
        esConsumoInterno,
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

  // Cierre manual de emergencia: cuando el dispositivo de QR/posnet falló o se
  // decide cobrar con otra terminal aparte (en modo standalone), se registra la
  // venta bajo el MISMO medio de pago (misma comisión/caja configurada) sin
  // esperar la confirmación del dispositivo integrado. El comprobante de la
  // terminal alternativa es opcional, solo para poder reconciliar después.
  async function confirmarCobroManual(comprobante: string) {
    if (!venta) return
    const pendiente = venta.pagoMpPendiente
    const montoCentavos = pendiente?.montoCentavos ?? totalACobrarCentavos
    const descuentoAplicado = pendiente?.descuentoCentavos ?? descuentoCentavos
    setManualLoading(true)
    try {
      if (pendiente) {
        // Limpiar el pendiente ANTES de crear la venta (no después del éxito): el
        // polling de use-pago-mp-polling.ts corre en paralelo cada 2.5s y si
        // justo en ese momento MP confirma el pago solo, terminaría creando una
        // segunda venta duplicada para el mismo cobro. Al sacarlo del store ya,
        // el próximo tick del poll no encuentra nada pendiente para esta venta.
        cancelarPagoMp(venta.id)
        // Best-effort: liberar la terminal (para posnet; QR no requiere cancelación real).
        await cancelarOrdenMpAction(pendiente.orderId, pendiente.tipo).catch(() => {})
      }

      const result = await crearVentaAction({
        lineas: carrito.map((l) => ({
          productId: l.productId,
          cantidad: l.cantidad,
          ...(l.esPesable && { gramos: l.gramos ?? 0 }),
        })),
        pagos: [
          {
            paymentMethodId: medioPagoId,
            montoCentavos,
            referencia: comprobante || undefined,
          },
        ],
        descuentoCentavos: descuentoAplicado,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      onVentaConfirmada()
      setSuccessInfo({
        ventaId: result.id,
        totalCentavos: montoCentavos,
        nombreMedioPago: medioPagoSeleccionado?.nombre ?? "",
      })
      qc.invalidateQueries({ queryKey: ["resumen"] })
      qc.invalidateQueries({ queryKey: ["productos"] })
      qc.invalidateQueries({ queryKey: ["cajas-panel"] })
      onSuccess?.(result.id)
      setManualDialogOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar el cobro manual")
    } finally {
      setManualLoading(false)
    }
  }

  return {
    venta, carrito, medioPagoId, mediosPago, medioPagoSeleccionado,
    subtotal, totalCentavos, comisionCentavos, recargoTotalCentavos, totalACobrarCentavos, faltaPeso,
    descuentoPct, descuentoCentavos, totalConDescuentoCentavos, setDescuentoPct,
    esConsumoInterno, setConsumoInterno,
    loading, successInfo, setSuccessInfo, confirmVaciar, setConfirmVaciar,
    manualDialogOpen, setManualDialogOpen, manualLoading, confirmarCobroManual,
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
