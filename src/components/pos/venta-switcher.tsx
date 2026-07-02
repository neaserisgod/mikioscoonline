"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Plus, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useVentasStore, type VentaAbierta } from "@/stores/ventas.store"
import { formatearARS } from "@/domain/dinero"
import { subtotalLinea } from "@/domain/pesables"
import { cn } from "@/lib/utils"

export function VentaSwitcher() {
  const { ventas, ventaActivaId, nuevaVenta, activarVenta, descartarVenta } = useVentasStore()

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
      {ventas.map((v) => (
        <VentaTab
          key={v.id}
          venta={v}
          activa={v.id === ventaActivaId}
          permiteDescartar={ventas.length > 1}
          onActivar={() => activarVenta(v.id)}
          onDescartar={() => descartarVenta(v.id)}
        />
      ))}

      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0 size-7 rounded-lg text-muted-foreground hover:text-foreground border border-dashed border-border/60"
        aria-label="Nueva venta"
        onClick={() => nuevaVenta()}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  )
}

function VentaTab({
  venta: v, activa, permiteDescartar, onActivar, onDescartar,
}: {
  venta: VentaAbierta
  activa: boolean
  permiteDescartar: boolean
  onActivar: () => void
  onDescartar: () => void
}) {
  const [confirmando, setConfirmando] = useState(false)
  const total = v.carrito.reduce(
    (s, l) => s + subtotalLinea({ esPesable: l.esPesable, precioUnitarioCentavos: l.precioUnitarioCentavos, cantidad: l.cantidad, gramos: l.gramos }),
    0
  )

  function pedirDescarte(e: React.MouseEvent) {
    e.stopPropagation()
    if (v.carrito.length > 0) {
      setConfirmando(true)
    } else {
      onDescartar()
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.88 }}
      transition={{ type: "spring", stiffness: 340, damping: 32 }}
      className={cn(
        "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer select-none shrink-0 transition-colors",
        confirmando
          ? "border-k-loss/40 bg-k-loss/8 text-k-loss"
          : activa
            ? "border-primary/40 bg-primary/8 text-foreground"
            : "border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-border"
      )}
      onClick={confirmando ? undefined : onActivar}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => !confirmando && e.key === "Enter" && onActivar()}
    >
      {confirmando ? (
        <>
          <span>¿Descartar {v.label}?</span>
          <button
            type="button"
            aria-label="Confirmar descarte"
            className="ml-0.5 rounded-sm hover:opacity-70"
            onClick={(e) => { e.stopPropagation(); onDescartar() }}
          >
            <Check className="size-3" />
          </button>
          <button
            type="button"
            aria-label="Cancelar"
            className="rounded-sm hover:opacity-70"
            onClick={(e) => { e.stopPropagation(); setConfirmando(false) }}
          >
            <X className="size-3" />
          </button>
        </>
      ) : (
        <>
          <span>{v.label}</span>
          {v.carrito.length > 0 && (
            <span className="tabular-nums text-muted-foreground">
              · {formatearARS(total)}
            </span>
          )}
          {permiteDescartar && (
            <button
              type="button"
              aria-label={`Descartar ${v.label}`}
              className="ml-0.5 rounded-sm text-muted-foreground hover:text-k-loss transition-colors"
              onClick={pedirDescarte}
            >
              <X className="size-3" />
            </button>
          )}
        </>
      )}
    </motion.div>
  )
}
