"use client"

import { useCallback, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Camera } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { CarritoPanel } from "@/components/pos/carrito-panel"
import { VentaSwitcher } from "@/components/pos/venta-switcher"
import { useVentasStore } from "@/stores/ventas.store"
import { useState } from "react"

interface Producto {
  id: string
  sku: string
  nombre: string
  precioCentavos: number
  costoCentavos: number
  stock: number
  category: { cajaId: string | null }
  esPesable: boolean
  precioPorKgCentavos: number | null
  stockGramos: number | null
}

export default function VenderPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)

  const { agregarProducto } = useVentasStore()

  const { data: productos } = useQuery<Producto[]>({
    queryKey: ["productos-search", query],
    queryFn: () =>
      query.length >= 1
        ? fetch(`/api/productos?q=${encodeURIComponent(query)}`).then((r) => r.json())
        : Promise.resolve([]),
    enabled: query.length >= 1,
  })

  const agregar = useCallback(
    (p: Producto) => {
      if (p.esPesable) {
        if ((p.stockGramos ?? 0) <= 0) { toast.warning("Sin stock disponible"); return }
        agregarProducto({
          productId: p.id,
          nombre: p.nombre,
          sku: p.sku,
          precioUnitarioCentavos: p.precioPorKgCentavos ?? 0,
          stock: 0,
          stockGramos: p.stockGramos,
          esPesable: true,
          cajaId: p.category.cajaId,
        })
        toast.info(`Cargá el peso de "${p.nombre}" en el carrito`)
      } else {
        if (p.stock < 1) { toast.warning("Sin stock disponible"); return }
        agregarProducto({
          productId: p.id,
          nombre: p.nombre,
          sku: p.sku,
          precioUnitarioCentavos: p.precioCentavos,
          stock: p.stock,
          stockGramos: null,
          esPesable: false,
          cajaId: p.category.cajaId,
        })
      }
      setQuery("")
      setShowDropdown(false)
      inputRef.current?.focus()
    },
    [agregarProducto]
  )

  return (
    <div className="space-y-4">
      {/* Switcher de ventas en paralelo */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold shrink-0">Vender</h1>
        <VentaSwitcher />
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100dvh-10rem)]">
        {/* Panel izquierdo: búsqueda + carrito items */}
        <div className="flex flex-col flex-1 min-w-0 gap-4">
          {/* Buscador */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  ref={inputRef}
                  autoFocus
                  placeholder="Nombre, SKU o código de barras..."
                  className="pl-9 h-11 text-base rounded-xl bg-card border-border/60"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setShowDropdown(true) }}
                  onFocus={() => query && setShowDropdown(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { setShowDropdown(false); setQuery("") }
                    // Si hay exactamente un resultado, Enter lo agrega — el scanner global se abstiene
                    // cuando el foco está en este input (ver use-global-scanner.ts)
                    if (e.key === "Enter" && productos && productos.length === 1) {
                      agregar(productos[0])
                    }
                  }}
                  // Marca este input para que el escáner global lo detecte y se abstenga
                  data-pos-search-input
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-xl shrink-0 lg:hidden border-border/60"
                aria-label="Escanear código"
                onClick={() => toast.info("Cámara disponible en modo escáner")}
              >
                <Camera className="size-4" />
              </Button>
            </div>

            {/* Dropdown resultados */}
            <AnimatePresence>
              {showDropdown && query.length >= 1 && (
                <motion.div
                  className="absolute z-50 mt-1 w-full rounded-xl border border-border/60 bg-popover shadow-xl overflow-hidden"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                >
                  {!productos || productos.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">
                      Sin resultados para &quot;{query}&quot;
                    </p>
                  ) : (
                    <ul className="max-h-64 overflow-y-auto py-1">
                      {productos.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-center justify-between gap-3"
                            onClick={() => agregar(p)}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{p.nombre}</p>
                              <p className="text-xs text-muted-foreground">{p.sku}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold tabular-nums">
                                {formatPrice(p.esPesable ? (p.precioPorKgCentavos ?? 0) : p.precioCentavos)}
                                {p.esPesable && "/kg"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {p.esPesable
                                  ? `Stock: ${((p.stockGramos ?? 0) / 1000).toFixed(3)} kg`
                                  : `Stock: ${p.stock}`}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Área carrito vacío */}
          <CarritoVacioGuard />
        </div>

        {/* Panel derecho: cobro */}
        <div className="lg:w-72 shrink-0">
          <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 lg:sticky lg:top-0 overflow-y-auto lg:max-h-[calc(100dvh-10rem)]">
            <CarritoPanel />
          </div>
        </div>
      </div>
    </div>
  )
}

function formatPrice(centavos: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(
    centavos / 100
  )
}

function CarritoVacioGuard() {
  const carrito = useVentasStore((s) => {
    const activa = s.ventas.find((v) => v.id === s.ventaActivaId)
    return activa?.carrito ?? []
  })

  if (carrito.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="El carrito está vacío"
        description="Buscá o escaneá un producto para agregarlo"
      />
    )
  }
  return null
}
