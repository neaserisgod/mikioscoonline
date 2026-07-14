"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Minus, Plus, Trash2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { formatearARS } from "@/domain/dinero"
import { cn } from "@/lib/utils"
import type { CarritoCheckout } from "./use-carrito-checkout"

interface CarritoItemsListProps {
  checkout: Pick<CarritoCheckout, "carrito" | "subtotal" | "cambiarCantidad" | "setCantidad" | "setGramos" | "eliminarLinea">
  className?: string
}

export function CarritoItemsList({ checkout, className }: CarritoItemsListProps) {
  const { carrito, subtotal, cambiarCantidad, setCantidad, setGramos, eliminarLinea } = checkout

  if (carrito.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="El carrito está vacío"
        description="Buscá o escaneá un producto para agregarlo"
      />
    )
  }

  return (
    <div className={cn("overflow-y-auto rounded-2xl border border-border/60 bg-card divide-y divide-border/40", className)}>
      <AnimatePresence initial={false}>
        {carrito.map((item) => (
          <motion.div
            key={item.productId}
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="px-4 py-3"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.nombre}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatearARS(item.precioUnitarioCentavos)}{item.esPesable ? "/kg" : " c/u"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <p className="text-sm font-semibold tabular-nums">
                  {formatearARS(subtotal(item))}
                </p>
                <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-k-loss"
                  onClick={() => eliminarLinea(item.productId)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
            {item.esPesable ? (() => {
              const gramos = item.gramos ?? 0
              const superaStock = gramos > (item.stockGramos ?? 0)
              return (
                <div className="flex items-center gap-1.5 mt-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={gramos}
                    onChange={(e) => setGramos(item.productId, Number(e.target.value) || 0)}
                    className={cn(
                      "h-7 w-24 rounded-md border bg-background px-2 text-xs font-semibold tabular-nums",
                      gramos <= 0 || superaStock ? "border-k-loss/40" : "border-border/60"
                    )}
                  />
                  <span className="text-xs text-muted-foreground">gramos</span>
                  {gramos <= 0 ? (
                    <span className="text-xs text-k-loss">Falta cargar el peso</span>
                  ) : superaStock ? (
                    <span className="text-xs text-k-loss">
                      Supera el stock cargado ({((item.stockGramos ?? 0) / 1000).toFixed(3)}kg) — re-buscá el producto para refrescarlo
                    </span>
                  ) : null}
                </div>
              )
            })() : (() => {
              const superaStock = item.cantidad > item.stock
              return (
                <div className="flex items-center gap-1.5 mt-2">
                  <Button variant="outline" size="icon-sm" className="size-7 rounded-md border-border/60"
                    onClick={() => cambiarCantidad(item.productId, -1)}>
                    <Minus className="size-3" />
                  </Button>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={item.cantidad}
                    onChange={(e) => setCantidad(item.productId, Number(e.target.value) || 0)}
                    className={cn(
                      "h-7 w-14 rounded-md border bg-background px-1.5 text-center text-sm font-semibold tabular-nums",
                      superaStock ? "border-k-loss/40" : "border-border/60"
                    )}
                  />
                  <Button variant="outline" size="icon-sm" className="size-7 rounded-md border-border/60"
                    onClick={() => cambiarCantidad(item.productId, 1)}>
                    <Plus className="size-3" />
                  </Button>
                  {superaStock && (
                    <span className="text-xs text-k-loss">Supera el stock ({item.stock})</span>
                  )}
                </div>
              )
            })()}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
