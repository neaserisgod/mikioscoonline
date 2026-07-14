"use client"

import { cn } from "@/lib/utils"

interface SegmentedTabsProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}

/** Selector tipo pill para navegar entre secciones unificadas en una misma
 * página (ej. Clientes/Rentabilidad/Historial, Productos/Proveedores/Pedidos)
 * — mismo lenguaje visual que ya usan los selectores de período/agrupador. */
export function SegmentedTabs<T extends string>({ value, onChange, options }: SegmentedTabsProps<T>) {
  return (
    <div className="flex w-fit gap-1 rounded-full bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
            value === o.value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
