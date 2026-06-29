"use client"

import { motion } from "framer-motion"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useVentasStore } from "@/stores/ventas.store"
import { formatearARS } from "@/domain/dinero"
import { cn } from "@/lib/utils"

export function VentaSwitcher() {
  const { ventas, ventaActivaId, nuevaVenta, activarVenta, descartarVenta } = useVentasStore()

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
      {ventas.map((v) => {
        const total = v.carrito.reduce((s, l) => s + l.precioUnitarioCentavos * l.cantidad, 0)
        const activa = v.id === ventaActivaId

        return (
          <motion.div
            key={v.id}
            layout
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.88 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer select-none shrink-0 transition-colors",
              activa
                ? "border-primary/40 bg-primary/8 text-foreground"
                : "border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-border"
            )}
            onClick={() => activarVenta(v.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && activarVenta(v.id)}
          >
            <span>{v.label}</span>
            {v.carrito.length > 0 && (
              <span className="tabular-nums text-muted-foreground">
                · {formatearARS(total)}
              </span>
            )}
            {ventas.length > 1 && (
              <button
                type="button"
                aria-label={`Descartar ${v.label}`}
                className="ml-0.5 rounded-sm text-muted-foreground hover:text-k-loss transition-colors"
                onClick={(e) => { e.stopPropagation(); descartarVenta(v.id) }}
              >
                <X className="size-3" />
              </button>
            )}
          </motion.div>
        )
      })}

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
