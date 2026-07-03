"use client"

import { cn } from "@/lib/utils"
import { useCarritoCheckout } from "./use-carrito-checkout"
import { CarritoItemsList } from "./carrito-items-list"
import { CarritoResumenPanel } from "./carrito-resumen-panel"

interface CarritoPanelProps {
  /** Al confirmar con éxito. El caller decide si navega, cierra overlay, etc. */
  onSuccess?: (ventaId: string) => void
  /** Mostrar botón "Expandir a /vender" (sólo en overlay) */
  expandAction?: React.ReactNode
  compact?: boolean
}

/**
 * Todo apilado en una columna: lista de productos + resumen de cobro.
 * Usado en la venta rápida (overlay). En /vender, la lista de productos y
 * el resumen se muestran por separado (ver vender-client.tsx) para
 * aprovechar el ancho de pantalla.
 */
export function CarritoPanel({ onSuccess, expandAction, compact = false }: CarritoPanelProps) {
  const checkout = useCarritoCheckout(onSuccess)

  if (!checkout.venta || checkout.successInfo) {
    return <CarritoResumenPanel checkout={checkout} expandAction={expandAction} mostrarItems />
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {checkout.carrito.length > 0 && (
        <CarritoItemsList checkout={checkout} className={cn(compact ? "max-h-40" : "max-h-64")} />
      )}
      <CarritoResumenPanel checkout={checkout} expandAction={expandAction} mostrarItems />
    </div>
  )
}
