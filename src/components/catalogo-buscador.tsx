"use client"

import { useState } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import catalogoRaw from "@/data/catalogo-atencion24.json"

interface CatalogoItem {
  nombre: string
  sku: string
  categoria: string
}

const catalogo = catalogoRaw as CatalogoItem[]

interface Props {
  onSelect: (item: CatalogoItem) => void
  className?: string
}

export function CatalogoBuscador({ onSelect, className }: Props) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)

  const q = query.trim().toLowerCase()
  const filtered =
    q.length >= 2
      ? catalogo
          .filter((item) => item.nombre.toLowerCase().includes(q) || item.sku.includes(q))
          .slice(0, 8)
      : []

  function handleSelect(item: CatalogoItem) {
    onSelect(item)
    setQuery("")
    setOpen(false)
  }

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => q.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar por nombre o código de barras..."
          className="pl-8 pr-8 rounded-xl"
        />
        {query && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault()
              setQuery("")
              setOpen(false)
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          {filtered.map((item, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => handleSelect(item)}
              className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex items-start gap-3 border-b border-border/40 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.nombre}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{item.categoria}</p>
              </div>
              {item.sku && (
                <span className="text-xs text-muted-foreground tabular-nums shrink-0 mt-0.5">
                  {item.sku}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
