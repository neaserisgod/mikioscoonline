"use client"

import { motion } from "framer-motion"
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatearARS } from "@/domain/dinero"
import { cn } from "@/lib/utils"
import type { CarritoCheckout } from "./use-carrito-checkout"

interface CarritoResumenPanelProps {
  checkout: CarritoCheckout
  /** Repetir el detalle de líneas acá (venta rápida en overlay, sin lista aparte). */
  mostrarItems?: boolean
  /** Mostrar botón "Expandir a /vender" (sólo en overlay) */
  expandAction?: React.ReactNode
}

export function CarritoResumenPanel({ checkout, mostrarItems = false, expandAction }: CarritoResumenPanelProps) {
  const {
    venta, carrito, medioPagoId, mediosPago, medioPagoSeleccionado, subtotal,
    totalCentavos, comisionCentavos, recargoTotalCentavos, totalACobrarCentavos, faltaPeso,
    loading, successInfo, setSuccessInfo, confirmVaciar, setConfirmVaciar,
    vaciarCarrito, setMedioPago, confirmar,
  } = checkout

  if (!venta) return null

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

      {/* Resumen tipo ticket — último vistazo antes de confirmar, sin paso extra */}
      {carrito.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Resumen</p>
          {mostrarItems && (
            <div className="space-y-1">
              {carrito.map((item) => (
                <div key={item.productId} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-muted-foreground">
                    {item.esPesable ? `${((item.gramos ?? 0) / 1000).toFixed(3)}kg` : `${item.cantidad}x`} {item.nombre}
                  </span>
                  <span className="tabular-nums shrink-0">{formatearARS(subtotal(item))}</span>
                </div>
              ))}
              <Separator className="bg-border/40" />
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatearARS(totalCentavos)}</span>
          </div>
          {recargoTotalCentavos > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Recargo virtual</span>
              <span className="tabular-nums">+{formatearARS(recargoTotalCentavos)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatearARS(totalACobrarCentavos)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Medio de pago</span>
            <span>{medioPagoSeleccionado?.nombre ?? "Sin elegir"}</span>
          </div>

          {comisionCentavos > 0 && (
            <>
              <Separator className="bg-border/40" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Comisión</span>
                <span className="text-k-loss tabular-nums">−{formatearARS(comisionCentavos)}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Neto recibido</span>
                <span className={cn("tabular-nums", recargoTotalCentavos >= comisionCentavos ? "text-k-gain" : "text-k-loss")}>
                  {formatearARS(totalACobrarCentavos - comisionCentavos)}
                </span>
              </div>
              {/* Aviso cuando el recargo no cubre la comisión */}
              {recargoTotalCentavos < comisionCentavos && (
                <div className="flex items-center gap-1.5 rounded-lg bg-k-loss/8 border border-k-loss/20 px-2.5 py-1.5 text-xs text-k-loss">
                  <AlertTriangle className="size-3 shrink-0" />
                  El recargo no cubre la comisión del medio de pago
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="space-y-2 mt-auto">
        {expandAction}
        <Button
          className="w-full h-10 rounded-xl"
          disabled={carrito.length === 0 || !medioPagoId || loading || faltaPeso}
          onClick={confirmar}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Confirmar venta"}
        </Button>
        {carrito.length > 0 && (
          confirmVaciar ? (
            <div className="flex items-center justify-center gap-3 h-8 text-xs">
              <span className="text-k-loss font-medium">¿Vaciar carrito?</span>
              <button
                type="button"
                className="text-k-loss font-semibold hover:underline"
                onClick={() => { vaciarCarrito(); setConfirmVaciar(false) }}
              >
                Sí, vaciar
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:underline"
                onClick={() => setConfirmVaciar(false)}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="w-full text-xs text-muted-foreground h-8"
              onClick={() => setConfirmVaciar(true)}
            >
              Vaciar carrito
            </Button>
          )
        )}
      </div>
    </div>
  )
}
