"use client"

import { useCallback, useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Camera } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCarritoCheckout } from "@/components/pos/use-carrito-checkout"
import { CarritoItemsList } from "@/components/pos/carrito-items-list"
import { CarritoResumenPanel } from "@/components/pos/carrito-resumen-panel"
import { VentaSwitcher } from "@/components/pos/venta-switcher"
import { CajaEstadoBar } from "@/components/pos/caja-estado-bar"
import { CameraScannerSheet } from "@/components/scanner/camera-scanner-sheet"
import { useVentasStore } from "@/stores/ventas.store"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface Producto {
  id: string
  sku: string
  nombre: string
  precioCentavos: number
  costoCentavos: number
  stock: number
  esPesable: boolean
  precioPorKgCentavos: number | null
  stockGramos: number | null
  esCigarroSuelto: boolean
  category: { nombre: string }
}

export default function VenderClient() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const { agregarProducto } = useVentasStore()
  const checkout = useCarritoCheckout()

  const { data: productos } = useQuery<Producto[]>({
    queryKey: ["productos-search", query],
    queryFn: () =>
      query.length >= 1
        ? fetch(`/api/productos?q=${encodeURIComponent(query)}`).then((r) => r.json())
        : Promise.resolve([]),
    enabled: query.length >= 1,
  })

  // Nuevos resultados → resaltar el primero de nuevo (ver navegación con
  // flechas más abajo, evita elegir sin querer un producto de la búsqueda anterior).
  useEffect(() => { setHighlightedIndex(0) }, [productos])

  const agregar = useCallback(
    (p: Producto) => {
      const esCigarrillo = p.category.nombre === "Cigarrillos"
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
          esCigarrillo,
          esCigarroSuelto: p.esCigarroSuelto,
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
          esCigarrillo,
          esCigarroSuelto: p.esCigarroSuelto,
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
      <CajaEstadoBar />

      {/* Switcher de ventas en paralelo */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-medium shrink-0">Vender</h1>
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
                    // Navegación sin soltar el teclado: ↑↓ mueve el resaltado, Enter
                    // agrega el resaltado (el scanner global se abstiene cuando el
                    // foco está en este input — ver use-global-scanner.ts)
                    else if (e.key === "ArrowDown" && productos && productos.length > 0) {
                      e.preventDefault()
                      setHighlightedIndex((i) => Math.min(i + 1, productos.length - 1))
                    } else if (e.key === "ArrowUp" && productos && productos.length > 0) {
                      e.preventDefault()
                      setHighlightedIndex((i) => Math.max(i - 1, 0))
                    } else if (e.key === "Enter" && productos && productos.length > 0) {
                      agregar(productos[highlightedIndex] ?? productos[0])
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
                aria-label="Escanear código con la cámara"
                onClick={() => setCameraOpen(true)}
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
                      {productos.map((p, i) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className={cn(
                              "w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-center justify-between gap-3",
                              i === highlightedIndex && "bg-muted/50"
                            )}
                            onMouseEnter={() => setHighlightedIndex(i)}
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

          {query.length === 0 && <MasVendidos onAgregar={agregar} />}

          {/* Productos del carrito — acá vive el grueso de la pantalla */}
          <CarritoItemsList checkout={checkout} className="flex-1" />
        </div>

        {/* Panel derecho: cobro */}
        <div className="lg:w-80 shrink-0">
          <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 lg:sticky lg:top-0 overflow-y-auto lg:max-h-[calc(100dvh-10rem)]">
            <CarritoResumenPanel checkout={checkout} />
          </div>
        </div>
      </div>

      <CameraScannerSheet open={cameraOpen} onOpenChange={setCameraOpen} />
    </div>
  )
}

/** Acceso rápido a los productos más vendidos de los últimos 30 días, para
 * no tener que buscar los que salen todo el tiempo (bebidas, cigarrillos,
 * etc). Se oculta apenas el cajero empieza a escribir en el buscador. */
function MasVendidos({ onAgregar }: { onAgregar: (p: Producto) => void }) {
  const { data: productos } = useQuery<Producto[]>({
    queryKey: ["productos-mas-vendidos"],
    queryFn: () => fetch("/api/productos?masVendidos=1").then((r) => r.json()),
    staleTime: 5 * 60_000,
  })

  if (!productos || productos.length === 0) return null

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-0.5">
        Más vendidos
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
        {productos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onAgregar(p)}
            className="shrink-0 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-colors px-3 py-2 text-left"
          >
            <p className="text-sm font-medium truncate max-w-32">{p.nombre}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatPrice(p.esPesable ? (p.precioPorKgCentavos ?? 0) : p.precioCentavos)}
              {p.esPesable && "/kg"}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

function formatPrice(centavos: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(
    centavos / 100
  )
}
