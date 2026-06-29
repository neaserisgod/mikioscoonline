"use client"

import { useCallback, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { Minus, Plus, Trash2, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatearARS } from "@/domain/dinero"
import { crearVentaAction } from "@/app/actions/ventas.actions"
import { useVentasStore, useVentaActiva } from "@/stores/ventas.store"
import { cn } from "@/lib/utils"

interface MedioPago {
  id: string
  nombre: string
  comisionBp: number
  esMercadoPago: boolean
  esEfectivo: boolean
}

interface CajaRecargo {
  id: string
  esPrincipal: boolean
  recargoTipo: string
  recargoVirtualBp: number
  recargoVirtualFijoCentavos: number
}

function calcRecargoCaja(caja: CajaRecargo, monto: number): number {
  return caja.recargoTipo === "PORCENTUAL"
    ? Math.round(monto * caja.recargoVirtualBp / 10_000)
    : caja.recargoVirtualFijoCentavos
}

interface CarritoPanelProps {
  /** Al confirmar con éxito. El caller decide si navega, cierra overlay, etc. */
  onSuccess?: (ventaId: string) => void
  /** Mostrar botón "Expandir a /vender" (sólo en overlay) */
  expandAction?: React.ReactNode
  compact?: boolean
}

export function CarritoPanel({ onSuccess, expandAction, compact = false }: CarritoPanelProps) {
  const qc = useQueryClient()
  const venta = useVentaActiva()
  const { cambiarCantidad, eliminarLinea, vaciarCarrito, setMedioPago, onVentaConfirmada } =
    useVentasStore()
  const [loading, setLoading] = useState(false)
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

  const { data: cajas } = useQuery<CajaRecargo[]>({
    queryKey: ["cajas-panel"],
    queryFn: () => fetch("/api/cajas").then((r) => r.json()),
    staleTime: 5 * 60_000,
  })

  if (!venta) return null

  const { carrito, medioPagoId } = venta
  const totalCentavos = carrito.reduce((s, l) => s + l.precioUnitarioCentavos * l.cantidad, 0)
  const medioPagoSeleccionado = mediosPago?.find((m) => m.id === medioPagoId)
  const comisionCentavos = medioPagoSeleccionado
    ? Math.round((totalCentavos * medioPagoSeleccionado.comisionBp) / 10_000)
    : 0

  // Recargo virtual por pago no-efectivo
  const cajaPrincipal = cajas?.find((c) => c.esPrincipal)
  let recargoTotalCentavos = 0
  if (medioPagoSeleccionado && !medioPagoSeleccionado.esEfectivo && cajaPrincipal) {
    const montoPorCaja = new Map<string, number>()
    for (const item of carrito) {
      const cajaId = item.cajaId ?? cajaPrincipal.id
      montoPorCaja.set(cajaId, (montoPorCaja.get(cajaId) ?? 0) + item.precioUnitarioCentavos * item.cantidad)
    }
    for (const [cajaId, monto] of montoPorCaja) {
      const caja = cajas?.find((c) => c.id === cajaId) ?? cajaPrincipal
      recargoTotalCentavos += calcRecargoCaja(caja, monto)
    }
  }
  const totalACobrarCentavos = totalCentavos + recargoTotalCentavos

  async function confirmar() {
    if (!medioPagoId) { toast.error("Seleccioná un medio de pago"); return }
    if (carrito.length === 0) return
    setLoading(true)
    try {
      const result = await crearVentaAction({
        lineas: carrito.map((l) => ({ productId: l.productId, cantidad: l.cantidad })),
        pagos: [{ paymentMethodId: medioPagoId, montoCentavos: totalACobrarCentavos }],
      })
      const ventaId = (result as { id: string }).id
      setSuccessInfo({
        ventaId,
        totalCentavos: totalACobrarCentavos,
        nombreMedioPago: medioPagoSeleccionado?.nombre ?? "",
      })
      onVentaConfirmada()
      qc.invalidateQueries({ queryKey: ["resumen"] })
      qc.invalidateQueries({ queryKey: ["productos"] })
      qc.invalidateQueries({ queryKey: ["cajas-panel"] })
      onSuccess?.(ventaId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al registrar la venta"
      // Mensaje específico para sobreventa entre carritos paralelos
      if (msg.toLowerCase().includes("stock")) {
        toast.error("Stock insuficiente — otro carrito ya reservó esas unidades")
      } else {
        toast.error(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Pantalla de éxito ────────────────────────────────────────────────────────
  if (successInfo) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center gap-5 py-10 text-center"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
      >
        <motion.div
          className="rounded-full bg-k-gain-muted p-5"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.08 }}
        >
          <CheckCircle2 className="size-8 text-k-gain" />
        </motion.div>
        <div className="space-y-0.5">
          <p className="text-lg font-semibold">Venta registrada</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatearARS(successInfo.totalCentavos)} · {successInfo.nombreMedioPago}
          </p>
        </div>
        <Button onClick={() => setSuccessInfo(null)} size="sm" className="min-w-32">
          Listo
        </Button>
      </motion.div>
    )
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Total */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total</p>
        <p className="text-3xl font-semibold tabular-nums mt-0.5">{formatearARS(totalACobrarCentavos)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {carrito.length === 0
            ? "Sin productos"
            : `${carrito.reduce((s, l) => s + l.cantidad, 0)} unidades`}
        </p>
      </div>

      <Separator className="bg-border/60" />

      {/* Carrito items */}
      {carrito.length > 0 && (
        <div className={cn("overflow-y-auto rounded-xl border border-border/60 bg-card divide-y divide-border/40", compact ? "max-h-40" : "flex-1")}>
          <AnimatePresence initial={false}>
            {carrito.map((item) => (
              <motion.div
                key={item.productId}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="flex items-center gap-2 px-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.nombre}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {formatearARS(item.precioUnitarioCentavos)} c/u
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="outline" size="icon-sm" className="size-6 rounded-md border-border/60"
                    onClick={() => cambiarCantidad(item.productId, -1)}>
                    <Minus className="size-2.5" />
                  </Button>
                  <span className="w-5 text-center text-xs font-semibold tabular-nums">{item.cantidad}</span>
                  <Button variant="outline" size="icon-sm" className="size-6 rounded-md border-border/60"
                    disabled={item.cantidad >= item.stock}
                    onClick={() => cambiarCantidad(item.productId, 1)}>
                    <Plus className="size-2.5" />
                  </Button>
                </div>
                <p className="text-xs font-semibold tabular-nums w-20 text-right shrink-0">
                  {formatearARS(item.precioUnitarioCentavos * item.cantidad)}
                </p>
                <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-k-loss shrink-0"
                  onClick={() => eliminarLinea(item.productId)}>
                  <Trash2 className="size-3" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Separator className="bg-border/60" />

      {/* Medios de pago */}
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Medio de pago</p>
        <div className="grid grid-cols-1 gap-1.5">
          {mediosPago?.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMedioPago(m.id)}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl border text-sm font-medium transition-all",
                medioPagoId === m.id
                  ? "border-primary bg-primary/8 text-foreground"
                  : "border-border/60 bg-background hover:bg-muted/30 text-muted-foreground"
              )}
            >
              <span>{m.nombre}</span>
              {m.comisionBp > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {(m.comisionBp / 100).toFixed(2)}%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Recargo virtual + comisión / neto */}
      {(recargoTotalCentavos > 0 || comisionCentavos > 0) && (
        <div className="space-y-1 text-sm">
          {recargoTotalCentavos > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Recargo virtual</span>
              <span className="tabular-nums">+{formatearARS(recargoTotalCentavos)}</span>
            </div>
          )}
          {comisionCentavos > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Comisión</span>
                <span className="text-k-loss tabular-nums">−{formatearARS(comisionCentavos)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span>Neto recibido</span>
                <span className={cn("tabular-nums", recargoTotalCentavos >= comisionCentavos ? "text-k-gain" : "text-k-loss")}>
                  {formatearARS(totalACobrarCentavos - comisionCentavos)}
                </span>
              </div>
            </>
          )}
          {/* Aviso cuando el recargo no cubre la comisión */}
          {comisionCentavos > 0 && recargoTotalCentavos < comisionCentavos && (
            <div className="flex items-center gap-1.5 rounded-lg bg-k-loss/8 border border-k-loss/20 px-2.5 py-1.5 text-xs text-k-loss">
              <AlertTriangle className="size-3 shrink-0" />
              El recargo no cubre la comisión del medio de pago
            </div>
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="space-y-2 mt-auto">
        {expandAction}
        <Button
          className="w-full h-10 rounded-xl"
          disabled={carrito.length === 0 || !medioPagoId || loading}
          onClick={confirmar}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Confirmar venta"}
        </Button>
        {carrito.length > 0 && (
          <Button variant="ghost" className="w-full text-xs text-muted-foreground h-8" onClick={vaciarCarrito}>
            Vaciar carrito
          </Button>
        )}
      </div>
    </div>
  )
}
