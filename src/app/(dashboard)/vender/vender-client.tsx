"use client"

import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Camera } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCarritoCheckout } from "@/components/pos/use-carrito-checkout"
import { CarritoItemsList } from "@/components/pos/carrito-items-list"
import { CarritoResumenPanel } from "@/components/pos/carrito-resumen-panel"
import { VentaSwitcher } from "@/components/pos/venta-switcher"
import { CajaEstadoBar } from "@/components/pos/caja-estado-bar"
import { CameraScannerSheet } from "@/components/scanner/camera-scanner-sheet"
import { useBarcodeHandler } from "@/components/scanner/use-barcode-handler"
import { useVentasStore } from "@/stores/ventas.store"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface VarianteProducto {
  id: string
  nombre: string
  unidadesPorVenta: number
  precioCentavos: number
  costoCentavos: number
  barcode: string | null
  sku: string | null
}

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
  variantes?: VarianteProducto[]
}

/** Número por prefijo en el buscador. Para productos por unidad son unidades
 * ("2 coca" → 2 u.); para pesables son GRAMOS ("200 queso barra" → 200 g de
 * Queso Barra). Formatos: "N termino", "Nx termino", "N*termino".
 * `cantidad` = null cuando no hay prefijo (unidad = 1, pesable = cargar peso a
 * mano). Un código de barras (solo dígitos, sin espacio) nunca matchea. */
function parseCantidadQuery(raw: string): { cantidad: number | null; termino: string } {
  const t = raw.trimStart()
  const m = /^(\d{1,5})\s*[xX*]\s*(.+)$/.exec(t) ?? /^(\d{1,5})\s+(.+)$/.exec(t)
  if (m) {
    const c = parseInt(m[1], 10)
    const term = m[2].trim()
    if (c >= 1 && term.length >= 1) return { cantidad: c, termino: term }
  }
  return { cantidad: null, termino: raw }
}

export default function VenderClient() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [selectorProducto, setSelectorProducto] = useState<Producto | null>(null)

  const { agregarProducto } = useVentasStore()
  const checkout = useCarritoCheckout()
  const handleScan = useBarcodeHandler()

  // Número por prefijo (unidades o gramos). Para no romper nombres que empiezan
  // con número ("9 de oro"), se busca SIEMPRE el texto completo; solo si ese no
  // matcha ningún producto y hay un número adelante, se interpreta como cantidad
  // y se busca el término sin el número ("2 coca" → 2× coca).
  const { cantidad: prefijoCantidad, termino } = parseCantidadQuery(query)
  const hayPrefijo = termino !== query

  const buscar = (q: string): Promise<Producto[]> =>
    q.length >= 1 ? fetch(`/api/productos?q=${encodeURIComponent(q)}`).then((r) => r.json()) : Promise.resolve([])

  const { data: resultadosCompletos } = useQuery<Producto[]>({
    queryKey: ["productos-search", query],
    queryFn: () => buscar(query),
    enabled: query.length >= 1,
  })
  const { data: resultadosSinPrefijo } = useQuery<Producto[]>({
    queryKey: ["productos-search", termino],
    queryFn: () => buscar(termino),
    enabled: hayPrefijo && termino.length >= 1,
  })

  // El query completo matchea (ej. "9 de oro") → usar tal cual, cantidad 1.
  // No matchea pero hay prefijo → interpretar como cantidad/gramos.
  const completoMatchea = (resultadosCompletos?.length ?? 0) > 0
  const usarPrefijo = hayPrefijo && !completoMatchea
  const productos = usarPrefijo ? resultadosSinPrefijo : resultadosCompletos
  const cantidadRef = useRef<number | null>(null)
  // useLayoutEffect (no useEffect) — corre sincrónicamente antes de que el
  // navegador pueda disparar el próximo evento de teclado, así el listener
  // global de más abajo nunca lee un valor stale (escribir el ref durante el
  // render directamente ya no lo permite el linter de hooks).
  useLayoutEffect(() => {
    cantidadRef.current = usarPrefijo ? prefijoCantidad : null
  }, [usarPrefijo, prefijoCantidad])

  // Estado de cobro accesible desde el listener global de más abajo (deps [],
  // sin closure viejo) — declarado y actualizado ANTES de ese listener (el
  // linter de hooks no permite modificar un ref en un efecto posterior al que
  // ya lo usa). useLayoutEffect sin array de deps corre sincrónicamente
  // después de CADA render, antes de que el navegador dispare el próximo
  // evento de teclado.
  const cobroRef = useRef({ activo: false, loading: false, ciclar: (_d: 1 | -1) => {}, confirmar: () => {} })
  useLayoutEffect(() => {
    cobroRef.current = {
      activo: termino.length === 0 && checkout.carrito.length > 0,
      loading: checkout.loading,
      ciclar: ciclarMedioPago,
      confirmar: checkout.confirmar,
    }
  })

  // Nuevos resultados → resaltar el primero de nuevo (ver navegación con
  // flechas más abajo, evita elegir sin querer un producto de la búsqueda anterior).
  // eslint-disable-next-line react-hooks/set-state-in-effect -- resetea el highlight al cambiar de lista, no re-render en loop
  useEffect(() => { setHighlightedIndex(0) }, [productos])

  // ── Foco del buscador: flujo 100% teclado ────────────────────────────────
  // (1) El cursor vuelve solo al buscador al montar y cada vez que el carrito
  //     queda vacío (recién confirmada una venta).
  const carritoVacio = checkout.carrito.length === 0
  useEffect(() => {
    if (carritoVacio) inputRef.current?.focus()
  }, [carritoVacio])
  // (2) Si el cajero hizo clic en otro lado (medio de pago, etc.) y empieza a
  //     escribir, el foco SALTA SOLO al buscador y captura ese carácter — sin
  //     tener que volver a clickear. Vale para LETRAS y NÚMEROS (el prefijo de
  //     cantidad/gramos arranca con número, "200 queso"). Un escáner de códigos
  //     también cae en el buscador, que matchea por código exacto (ver el
  //     fallback del Enter más abajo).
  useEffect(() => {
    function onDocKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const a = document.activeElement as HTMLElement | null
      const tag = a?.tagName
      const esBuscador = a?.getAttribute?.("data-pos-search-input") != null
      const enCampo = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || a?.isContentEditable

      // Cobro por teclado robusto: si el foco NO está en el buscador (se perdió, o
      // quedó en un botón), ↑/↓ cambian el medio de pago y Enter cobra — así las
      // flechas nunca scrollean la página. Con el buscador enfocado lo maneja su
      // propio onKeyDown. Enter sobre un botón se deja para su click nativo.
      if ((e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") && !esBuscador) {
        if (enCampo) return
        const c = cobroRef.current
        if (!c.activo) return
        if (e.key === "Enter") {
          if (tag === "BUTTON" || tag === "A") return
          e.preventDefault()
          if (!c.loading) c.confirmar()
        } else {
          e.preventDefault()
          c.ciclar(e.key === "ArrowDown" ? 1 : -1)
        }
        inputRef.current?.focus()
        return
      }

      // "Tipear en cualquier lado" (letras/números) enfoca el buscador y captura.
      if (!/^[\p{L}0-9]$/u.test(e.key)) return
      if (enCampo) return
      e.preventDefault()
      setQuery((prev) => prev + e.key)
      setShowDropdown(true)
      inputRef.current?.focus()
    }
    document.addEventListener("keydown", onDocKeyDown)
    return () => document.removeEventListener("keydown", onDocKeyDown)
  }, [])

  const agregarDirecto = useCallback(
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
        }, cantidadRef.current ?? undefined)
        // El prefijo numérico en pesables = gramos ("200 queso" → 200 g). Solo
        // pedimos cargar el peso a mano si no vino con prefijo.
        if (cantidadRef.current == null) toast.info(`Cargá el peso de "${p.nombre}" en el carrito`)
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
        }, cantidadRef.current ?? undefined)
      }
      setQuery("")
      setShowDropdown(false)
      setSelectorProducto(null)
      inputRef.current?.focus()
    },
    [agregarProducto]
  )

  // Variante elegida en el selector — el stock que se muestra/valida es el del
  // DUEÑO convertido a unidades de esta presentación (el stock real vive en
  // el dueño, ver stock.service.ts; acá solo se pinta/chequea el equivalente).
  const agregarVariante = useCallback(
    (dueño: Producto, v: VarianteProducto) => {
      if (dueño.stock < v.unidadesPorVenta) { toast.warning("Sin stock disponible"); return }
      agregarProducto({
        productId: v.id,
        nombre: v.nombre,
        sku: v.sku ?? dueño.sku,
        precioUnitarioCentavos: v.precioCentavos,
        stock: Math.floor(dueño.stock / v.unidadesPorVenta),
        stockGramos: null,
        esPesable: false,
        esCigarrillo: dueño.category.nombre === "Cigarrillos",
        esCigarroSuelto: dueño.esCigarroSuelto,
      }, cantidadRef.current ?? undefined)
      setQuery("")
      setShowDropdown(false)
      setSelectorProducto(null)
      inputRef.current?.focus()
    },
    [agregarProducto]
  )

  // Punto de entrada único desde la búsqueda/escaneo por texto, Más vendidos y
  // el Enter del buscador — si el producto tiene variantes, abre el selector
  // en vez de agregar directo (el escaneo de código de barras de una VARIANTE
  // puntual no pasa por acá, ver use-barcode-handler.ts).
  const agregar = useCallback(
    (p: Producto) => {
      if (p.variantes && p.variantes.length > 0) {
        setSelectorProducto(p)
        return
      }
      agregarDirecto(p)
    },
    [agregarDirecto]
  )

  // Cambiar el medio de pago con el teclado (↑/↓) cuando el buscador está vacío
  // y hay carrito — para cobrar sin soltar el teclado.
  function ciclarMedioPago(dir: 1 | -1) {
    const medios = checkout.mediosPago
    if (!medios || medios.length === 0) return
    const idx = medios.findIndex((m) => m.id === checkout.medioPagoId)
    const base = idx < 0 ? 0 : idx
    checkout.setMedioPago(medios[(base + dir + medios.length) % medios.length].id)
  }

  return (
    <div className="space-y-4">
      <CajaEstadoBar />

      {/* Switcher de ventas en paralelo (el título "Vender" ya está en el nav) */}
      <div className="flex items-center justify-end gap-4">
        <VentaSwitcher />
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100dvh-10rem)]">
        {/* Panel izquierdo: búsqueda + carrito items */}
        <div className="flex flex-col flex-1 min-w-0 gap-4">
          {/* Buscador */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
                <Input
                  ref={inputRef}
                  autoFocus
                  placeholder="Buscá o escaneá un producto..."
                  className="pl-11 h-14 text-base rounded-2xl bg-card border-transparent shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-ring"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setShowDropdown(true) }}
                  onFocus={() => query && setShowDropdown(true)}
                  onKeyDown={(e) => {
                    // Requiere el dropdown VISIBLE: tras agregar, react-query deja
                    // `productos` cacheado, pero el dropdown ya está cerrado — sin
                    // esto, las flechas seguían "navegando resultados" fantasma en
                    // vez de cambiar el medio de pago.
                    const hayResultados = showDropdown && !!productos && productos.length > 0
                    // "Modo cobro": buscador vacío + carrito cargado → el teclado
                    // opera sobre el cobro (elegir medio con ↑/↓, Enter confirma).
                    const enModoCobro = termino.length === 0 && checkout.carrito.length > 0
                    if (e.key === "Escape") { setShowDropdown(false); setQuery("") }
                    else if (e.key === "ArrowDown") {
                      if (hayResultados) { e.preventDefault(); setHighlightedIndex((i) => Math.min(i + 1, productos.length - 1)) }
                      else if (enModoCobro) { e.preventDefault(); ciclarMedioPago(1) }
                    } else if (e.key === "ArrowUp") {
                      if (hayResultados) { e.preventDefault(); setHighlightedIndex((i) => Math.max(i - 1, 0)) }
                      else if (enModoCobro) { e.preventDefault(); ciclarMedioPago(-1) }
                    } else if (e.key === "Enter") {
                      if (hayResultados) {
                        agregar(productos[highlightedIndex] ?? productos[0])
                      } else if (/^\d{6,}$/.test(termino)) {
                        // Código de barras sin match en la lista (el fetch pudo no
                        // haber vuelto todavía si vino de un escáner): lookup directo.
                        void handleScan(termino)
                        setQuery(""); setShowDropdown(false); inputRef.current?.focus()
                      } else if (enModoCobro && !checkout.loading) {
                        // Buscador vacío + carrito cargado → confirmar la venta con el
                        // medio de pago elegido (efectivo por defecto).
                        checkout.confirmar()
                      }
                    }
                  }}
                  // Marca este input para que el escáner global lo detecte y se abstenga
                  data-pos-search-input
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="size-14 rounded-2xl shrink-0 lg:hidden border-transparent bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04]"
                aria-label="Escanear código con la cámara"
                onClick={() => setCameraOpen(true)}
              >
                <Camera className="size-5" />
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

          {/* Productos del carrito — altura según contenido, con scroll propio si
              se llena (evita el card gigante vacío con pocos ítems). */}
          <CarritoItemsList checkout={checkout} className="max-h-[calc(100dvh-15rem)]" />
        </div>

        {/* Panel derecho: cobro */}
        <div className="lg:w-96 shrink-0">
          <div className="rounded-3xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] p-6 space-y-4 lg:sticky lg:top-0 overflow-y-auto lg:max-h-[calc(100dvh-10rem)]">
            <CarritoResumenPanel checkout={checkout} />
          </div>
        </div>
      </div>

      <CameraScannerSheet open={cameraOpen} onOpenChange={setCameraOpen} />

      <SelectorVarianteDialog
        producto={selectorProducto}
        onOpenChange={(open) => { if (!open) setSelectorProducto(null) }}
        onElegirDueño={agregarDirecto}
        onElegirVariante={agregarVariante}
      />
    </div>
  )
}

/** Sheet/popup que aparece al elegir un producto con variantes — el dueño
 * (presentación base) y cada variante, cada una con su propio precio y
 * stock equivalente. Escanear el código de una variante puntual no pasa por
 * acá (ver use-barcode-handler.ts). */
function SelectorVarianteDialog({
  producto,
  onOpenChange,
  onElegirDueño,
  onElegirVariante,
}: {
  producto: Producto | null
  onOpenChange: (open: boolean) => void
  onElegirDueño: (p: Producto) => void
  onElegirVariante: (dueño: Producto, v: VarianteProducto) => void
}) {
  return (
    <Dialog open={!!producto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{producto?.nombre}</DialogTitle>
        </DialogHeader>
        {producto && (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => onElegirDueño(producto)}
              disabled={producto.stock < 1}
              className="w-full text-left px-4 py-3 rounded-xl border border-border/60 hover:bg-muted/50 transition-colors flex items-center justify-between gap-3 disabled:opacity-40 disabled:pointer-events-none"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{producto.nombre}</p>
                <p className="text-xs text-muted-foreground">Unidad · Stock: {producto.stock}</p>
              </div>
              <p className="text-sm font-semibold tabular-nums shrink-0">{formatPrice(producto.precioCentavos)}</p>
            </button>

            {producto.variantes?.map((v) => {
              const stockEquivalente = Math.floor(producto.stock / v.unidadesPorVenta)
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onElegirVariante(producto, v)}
                  disabled={stockEquivalente < 1}
                  className="w-full text-left px-4 py-3 rounded-xl border border-border/60 hover:bg-muted/50 transition-colors flex items-center justify-between gap-3 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{v.nombre}</p>
                    <p className="text-xs text-muted-foreground">×{v.unidadesPorVenta} · Stock: {stockEquivalente}</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums shrink-0">{formatPrice(v.precioCentavos)}</p>
                </button>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
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
            className="shrink-0 rounded-2xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] hover:bg-muted/30 transition-colors px-4 py-2.5 text-left"
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
