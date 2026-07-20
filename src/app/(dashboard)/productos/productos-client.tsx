"use client"

import { useState, useEffect, useLayoutEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { motion } from "framer-motion"
import { stagger } from "@/lib/motion"
import { Plus, Search, AlertTriangle, Package, Truck, Tag, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { MarkupBadge } from "@/components/ui/markup-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { NavCard } from "@/components/ui/nav-card"
import { formatearARS } from "@/domain/dinero"
import { gananciaPotencial } from "@/domain/pesables"
import { cn } from "@/lib/utils"
import ProductoForm from "./producto-form"
import type { Variante } from "./variantes-section"

interface Producto {
  id: string
  sku: string
  nombre: string
  precioCentavos: number
  costoCentavos: number
  costoEsProvisional: boolean
  stock: number
  stockMinimo: number
  categoryId: string
  category: { nombre: string }
  providerId: string | null
  provider?: { nombre: string } | null
  locationId: string | null
  location?: { nombre: string } | null
  esPesable: boolean
  precioPorKgCentavos: number | null
  costoPorKgCentavos: number | null
  stockGramos: number | null
  stockMinimoGramos: number | null
  variantOfId: string | null
  variantes?: Variante[]
}

interface ResumenProveedor {
  id: string
  nombre: string
  totalProductos: number
  sinStock: number
  gananciaPotencialCentavos: number
}

interface ResumenCategoria {
  id: string
  nombre: string
  totalProductos: number
  gananciaPotencialCentavos: number
}

const PROD_COLS = "lg:grid-cols-[2fr_0.9fr_1fr_1fr_auto_auto]"

export default function ProductosClient() {
  const { data: session } = useSession()
  const esAdmin = session?.user?.role === "ADMIN"
  const [q, setQ] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [barcodePreset, setBarcodePreset] = useState<string | undefined>()
  const searchRef = useRef<HTMLInputElement>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const qc = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const proveedorId = searchParams.get("proveedorId")
  const categoriaId = searchParams.get("categoriaId")
  const filtroParam = searchParams.get("filtro")
  const filtroEspecial = filtroParam === "costoProvisional" || filtroParam === "margenNegativo" ? filtroParam : null

  // Scanner: ?barcode=XXX → abrir form nuevo con barcode prellenado
  // Scanner: ?abrir=ID → abrir form de edición del producto
  // (independiente de ?proveedorId=/?categoriaId=, que maneja la navegación en cards)
  useEffect(() => {
    const barcode = searchParams.get("barcode")
    const abrirId = searchParams.get("abrir")
    if (barcode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con el query param del scanner, no re-render en loop
      setBarcodePreset(barcode)
      setEditingId(null)
      setSheetOpen(true)
      router.replace("/productos")
    } else if (abrirId) {
      setEditingId(abrirId)
      setSheetOpen(true)
      router.replace("/productos")
    }
  }, [searchParams, router])

  // Nivel 1: cards de proveedores (también da los nombres para el breadcrumb en
  // los niveles 2 y 3, por eso se pide siempre que no haya búsqueda activa).
  const { data: resumenProveedores, isLoading: loadingProveedores } = useQuery<ResumenProveedor[]>({
    queryKey: ["productos-resumen-proveedores"],
    queryFn: () => fetch("/api/productos/resumen-proveedores").then((r) => r.json()),
    enabled: !q,
    staleTime: 30_000,
  })

  // Nivel 2: cards de categorías dentro del proveedor actual.
  const { data: resumenCategorias, isLoading: loadingCategorias } = useQuery<ResumenCategoria[]>({
    queryKey: ["productos-resumen-categorias", proveedorId],
    queryFn: () =>
      fetch(`/api/productos/resumen-categorias?providerId=${encodeURIComponent(proveedorId!)}`).then((r) => r.json()),
    enabled: !q && !!proveedorId,
    staleTime: 30_000,
  })

  // Productos del proveedor actual (sin filtrar por categoría) — solo para
  // sacar el detalle de la alerta de "sin stock" del nivel 2.
  const { data: productosDelProveedor } = useQuery<Producto[]>({
    queryKey: ["productos", "porProveedor", proveedorId],
    queryFn: () => fetch(`/api/productos?providerId=${encodeURIComponent(proveedorId!)}`).then((r) => r.json()),
    enabled: !q && !!proveedorId && !categoriaId,
    staleTime: 30_000,
  })

  // Nivel 3 (o búsqueda global / filtro especial, que ignoran el drill-down por completo).
  const { data: productos, isLoading: loadingProductos } = useQuery<Producto[]>({
    queryKey: ["productos", q, proveedorId, categoriaId, filtroEspecial],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filtroEspecial) {
        params.set(filtroEspecial, "1")
      } else if (q) {
        params.set("q", q)
      } else {
        if (proveedorId) params.set("providerId", proveedorId)
        if (categoriaId) params.set("categoryId", categoriaId)
      }
      return fetch(`/api/productos?${params.toString()}`).then((r) => r.json())
    },
    enabled: !!filtroEspecial || !!q || (!!proveedorId && !!categoriaId),
    staleTime: 30_000,
  })

  // ── Flujo por teclado (mismos parámetros que Vender) ──────────────────────
  const sheetOpenRef = useRef(sheetOpen)
  // useLayoutEffect (no useEffect) — corre sincrónicamente antes de que el
  // navegador pueda disparar el próximo evento, así el listener global de
  // teclado de más abajo nunca lee un valor stale (escribir el ref durante el
  // render directamente ya no lo permite el linter de hooks).
  useLayoutEffect(() => {
    sheetOpenRef.current = sheetOpen
  }, [sheetOpen])
  // El buscador se enfoca al cargar. Nueva búsqueda → resetea el resaltado.
  useEffect(() => { searchRef.current?.focus() }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- resetea el resaltado al cambiar la lista, no re-render en loop
  useEffect(() => { setHighlightedIndex(0) }, [productos])
  // Tipear una LETRA en cualquier parte enfoca el buscador y la captura (los
  // dígitos se dejan para el escáner, que en Productos suma stock). No roba el
  // foco cuando hay un diálogo abierto (alta/edición de producto).
  useEffect(() => {
    function onDocKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (sheetOpenRef.current) return
      if (!/^\p{L}$/u.test(e.key)) return
      const a = document.activeElement as HTMLElement | null
      const tag = a?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || a?.isContentEditable) return
      e.preventDefault()
      setQ((prev) => prev + e.key)
      searchRef.current?.focus()
    }
    document.addEventListener("keydown", onDocKeyDown)
    return () => document.removeEventListener("keydown", onDocKeyDown)
  }, [])

  // Contadores para los chips de "revisar" — solo ADMIN, ven costo/precio real.
  const { data: costoProvisionalList } = useQuery<Producto[]>({
    queryKey: ["productos-costo-provisional"],
    queryFn: () => fetch("/api/productos?costoProvisional=1").then((r) => r.json()),
    enabled: esAdmin,
    staleTime: 60_000,
  })
  const { data: margenNegativoList } = useQuery<Producto[]>({
    queryKey: ["productos-margen-negativo"],
    queryFn: () => fetch("/api/productos?margenNegativo=1").then((r) => r.json()),
    enabled: esAdmin,
    staleTime: 60_000,
  })

  const productoEditing = productos?.find((p) => p.id === editingId)

  const nombreProveedorActual = resumenProveedores?.find((p) => p.id === proveedorId)?.nombre
  const nombreCategoriaActual = resumenCategorias?.find((c) => c.id === categoriaId)?.nombre
  const sinStockProveedorActual = resumenProveedores?.find((p) => p.id === proveedorId)?.sinStock ?? 0
  const productosSinStock = (productosDelProveedor ?? []).filter((p) =>
    p.esPesable ? (p.stockGramos ?? 0) === 0 : p.stock === 0
  )

  function irAProveedor(id: string) {
    router.push(`/productos?proveedorId=${encodeURIComponent(id)}`)
  }
  function irACategoria(id: string) {
    router.push(`/productos?proveedorId=${encodeURIComponent(proveedorId!)}&categoriaId=${encodeURIComponent(id)}`)
  }
  function irANivelProveedores() {
    router.push("/productos")
  }
  function irANivelCategorias() {
    router.push(`/productos?proveedorId=${encodeURIComponent(proveedorId!)}`)
  }

  function abrirNuevo() {
    setEditingId(null)
    setSheetOpen(true)
  }

  function abrirEditar(id: string) {
    setEditingId(id)
    setSheetOpen(true)
  }

  function onSuccess() {
    setSheetOpen(false)
    qc.invalidateQueries({ queryKey: ["productos"] })
    qc.invalidateQueries({ queryKey: ["productos-resumen-proveedores"] })
    qc.invalidateQueries({ queryKey: ["productos-resumen-categorias"] })
    toast.success(editingId ? "Producto actualizado" : "Producto creado")
  }

  // defaults para "Nuevo producto" cuando se crea parado dentro de un
  // proveedor+categoría del drill-down (el sentinel "sin proveedor" no es un
  // Provider real, no se precarga).
  const defaultsNuevo = {
    categoryId: categoriaId ?? undefined,
    providerId: proveedorId && proveedorId !== "__sin_proveedor__" ? proveedorId : undefined,
  }

  const mostrandoLista = !!filtroEspecial || !!q || (!!proveedorId && !!categoriaId)

  // Ganancia potencial total de lo que se está viendo — nivel 1/2 vienen ya
  // sumados del backend; nivel 3/búsqueda se suma acá con el mismo cálculo
  // (domain/pesables.ts es lógica pura, se puede usar tal cual del lado del cliente).
  const gananciaPotencialTotal = mostrandoLista
    ? (productos ?? []).reduce((s, p) => s + gananciaPotencial(p), 0)
    : !proveedorId
      ? (resumenProveedores ?? []).reduce((s, p) => s + p.gananciaPotencialCentavos, 0)
      : (resumenCategorias ?? []).reduce((s, c) => s + c.gananciaPotencialCentavos, 0)

  function renderListaProductos(lista: Producto[] | undefined, isLoading: boolean) {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      )
    }
    if (!lista || lista.length === 0) {
      return (
        <EmptyState
          icon={Package}
          title={q ? `Sin resultados para "${q}"` : "Sin productos"}
          description={q ? undefined : "Creá tu primer producto"}
          action={
            !q ? (
              <Button size="sm" onClick={abrirNuevo}>
                <Plus className="size-3.5 mr-1.5" />
                Crear producto
              </Button>
            ) : undefined
          }
        />
      )
    }
    return (
      <div className="rounded-2xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] overflow-hidden">
        {/* Cabecera de tabla — solo desktop */}
        <div className={cn(
          "hidden lg:grid gap-x-4 px-4 py-2 text-xs text-muted-foreground font-medium bg-muted/20 border-b border-border/40",
          PROD_COLS
        )}>
          <span>Nombre</span>
          <span>SKU</span>
          <span>Categoría</span>
          <span className="text-right">Precio</span>
          <span className="text-center">{esAdmin && "Markup"}</span>
          <span className="text-right">Stock</span>
        </div>
        <motion.div
          className="divide-y divide-border/40"
          variants={stagger.container}
          initial="hidden"
          animate="show"
        >
          {lista.map((p, i) => {
            const precioDisplay = p.esPesable ? (p.precioPorKgCentavos ?? 0) : p.precioCentavos
            const costoDisplay = p.esPesable ? (p.costoPorKgCentavos ?? 0) : p.costoCentavos
            const stockDisplay = p.esPesable ? (p.stockGramos ?? 0) / 1000 : p.stock
            const stockMinimoDisplay = p.esPesable ? (p.stockMinimoGramos ?? 0) / 1000 : p.stockMinimo
            const stockUnidad = p.esPesable ? "kg" : "u."
            const markupBp =
              costoDisplay > 0
                ? Math.round(((precioDisplay - costoDisplay) / costoDisplay) * 10_000)
                : 0
            const esBajo = stockDisplay <= stockMinimoDisplay
            // Resaltado del teclado — solo durante una búsqueda activa (con `q`).
            const resaltado = !!q && i === highlightedIndex

            return (
              <motion.button
                key={p.id}
                variants={stagger.item}
                type="button"
                ref={(el) => { if (resaltado) el?.scrollIntoView({ block: "nearest" }) }}
                onClick={() => abrirEditar(p.id)}
                onMouseEnter={() => { if (q) setHighlightedIndex(i) }}
                className={cn(
                  "w-full flex items-center lg:grid gap-3 lg:gap-x-4 px-4 py-3 text-left transition-colors",
                  resaltado ? "bg-primary/10 ring-1 ring-inset ring-primary/20" : "hover:bg-muted/20",
                  PROD_COLS
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{p.nombre}</p>
                    {esBajo && <AlertTriangle className="size-3 text-k-loss shrink-0" />}
                    {p.costoEsProvisional && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                        costo est.
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground lg:hidden">
                    {p.sku}{p.category && ` · ${p.category.nombre}`}
                  </p>
                </div>

                <p className="hidden lg:block text-sm text-muted-foreground truncate">{p.sku}</p>

                <p className="hidden lg:block text-sm text-muted-foreground truncate">
                  {p.category?.nombre ?? "—"}
                </p>

                <p className="hidden lg:block text-sm font-semibold tabular-nums text-right">
                  {formatearARS(precioDisplay)}{p.esPesable && "/kg"}
                </p>

                <div className="text-right shrink-0 space-y-0.5 lg:hidden">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatearARS(precioDisplay)}{p.esPesable && "/kg"}
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    {esAdmin && <MarkupBadge markupBp={markupBp} />}
                    <span className={cn(
                      "text-xs tabular-nums",
                      esBajo ? "text-k-loss" : "text-muted-foreground"
                    )}>
                      {stockDisplay} {stockUnidad}
                    </span>
                  </div>
                </div>

                <div className="hidden lg:flex justify-center items-center">
                  {esAdmin && <MarkupBadge markupBp={markupBp} />}
                </div>

                <span className={cn(
                  "hidden lg:block text-sm tabular-nums text-right",
                  esBajo ? "text-k-loss font-medium" : "text-muted-foreground"
                )}>
                  {stockDisplay} {stockUnidad}
                </span>
              </motion.button>
            )
          })}
        </motion.div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Búsqueda + acción (el título "Productos" ya está en las tabs y el nav) */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchRef}
            autoFocus
            placeholder="Buscar por nombre, SKU o código de barras..."
            className="pl-11 h-14 text-base rounded-2xl bg-card border-transparent shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-ring"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              const lista = productos ?? []
              if (e.key === "Escape") { setQ("") }
              else if (e.key === "ArrowDown" && lista.length > 0) {
                e.preventDefault(); setHighlightedIndex((i) => Math.min(i + 1, lista.length - 1))
              } else if (e.key === "ArrowUp" && lista.length > 0) {
                e.preventDefault(); setHighlightedIndex((i) => Math.max(i - 1, 0))
              } else if (e.key === "Enter" && lista.length > 0) {
                // Abre el producto resaltado para editar — sin soltar el teclado.
                e.preventDefault(); abrirEditar((lista[highlightedIndex] ?? lista[0]).id)
              }
            }}
          />
        </div>
        <Button onClick={abrirNuevo} className="h-14 rounded-2xl gap-1.5 px-5 shrink-0">
          <Plus className="size-4" />
          Nuevo
        </Button>
      </div>

      {/* Chips de "revisar" — solo ADMIN, solo cuando no hay filtro/búsqueda activa */}
      {esAdmin && !q && !filtroEspecial && (
        <div className="flex flex-wrap gap-2">
          {!!costoProvisionalList?.length && (
            <button
              type="button"
              onClick={() => router.push("/productos?filtro=costoProvisional")}
              className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <AlertTriangle className="size-3" />
              {costoProvisionalList.length} con costo estimado
            </button>
          )}
          {!!margenNegativoList?.length && (
            <button
              type="button"
              onClick={() => router.push("/productos?filtro=margenNegativo")}
              className="flex items-center gap-1.5 rounded-full bg-k-loss/10 px-3 py-1.5 text-xs font-medium text-k-loss hover:bg-k-loss/15 transition-colors"
            >
              <AlertTriangle className="size-3" />
              {margenNegativoList.length} con margen negativo
            </button>
          )}
        </div>
      )}

      {/* Filtro especial activo (desde los chips de arriba) */}
      {filtroEspecial && (
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            {filtroEspecial === "costoProvisional" ? "Productos con costo estimado" : "Productos con margen negativo"}
          </span>
          <button type="button" onClick={() => router.push("/productos")} className="text-xs underline underline-offset-2">
            Quitar filtro
          </button>
        </div>
      )}

      {/* Breadcrumb del drill-down — oculto mientras hay una búsqueda o filtro activo */}
      {!q && !filtroEspecial && (
        <div className="flex items-center gap-1.5 text-sm">
          <button
            type="button"
            onClick={irANivelProveedores}
            className={cn(
              "hover:text-foreground transition-colors",
              !proveedorId ? "text-foreground font-medium" : "text-muted-foreground"
            )}
          >
            Proveedores
          </button>
          {proveedorId && (
            <>
              <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
              <button
                type="button"
                onClick={irANivelCategorias}
                className={cn(
                  "hover:text-foreground transition-colors truncate",
                  proveedorId && !categoriaId ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {nombreProveedorActual ?? "…"}
              </button>
            </>
          )}
          {categoriaId && (
            <>
              <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-foreground font-medium truncate">{nombreCategoriaActual ?? "…"}</span>
            </>
          )}
        </div>
      )}

      {/* Ganancia potencial: precio − costo del stock actual, no es rentabilidad real.
          Oculto para VENDEDOR — no ve costo/margen. */}
      {esAdmin && (
        <div className="rounded-2xl border border-k-gain/20 bg-k-gain-muted/20 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Ganancia potencial</p>
            <p className="text-[10px] text-muted-foreground">Si se vendiera todo el stock actual a precio de lista</p>
          </div>
          <p className="text-xl font-semibold tabular-nums text-k-gain">{formatearARS(gananciaPotencialTotal)}</p>
        </div>
      )}

      {mostrandoLista ? (
        renderListaProductos(productos, loadingProductos)
      ) : !proveedorId ? (
        // Nivel 1: cards de proveedores
        loadingProveedores ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : !resumenProveedores || resumenProveedores.length === 0 ? (
          <EmptyState icon={Package} title="Sin productos" description="Creá tu primer producto" />
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3"
            variants={stagger.container}
            initial="hidden"
            animate="show"
          >
            {resumenProveedores.map((p) => (
              <motion.div key={p.id} variants={stagger.item}>
                <NavCard
                  title={p.nombre}
                  sub={`${p.totalProductos} producto${p.totalProductos === 1 ? "" : "s"}`}
                  icon={Truck}
                  onClick={() => irAProveedor(p.id)}
                  badge={
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      {esAdmin && (
                        <span className="text-xs font-semibold tabular-nums text-k-gain">
                          {formatearARS(p.gananciaPotencialCentavos)}
                        </span>
                      )}
                      {p.sinStock > 0 && (
                        <span className="flex items-center gap-1 text-xs font-medium text-k-loss">
                          <AlertTriangle className="size-3.5" />
                          {p.sinStock}
                        </span>
                      )}
                    </div>
                  }
                />
              </motion.div>
            ))}
          </motion.div>
        )
      ) : (
        // Nivel 2: alerta de sin stock + cards de categorías
        <div className="space-y-4">
          {sinStockProveedorActual > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <AlertTriangle className="size-3.5 text-k-loss" />
                <p className="text-sm font-medium">Sin stock</p>
                <span className="text-xs text-muted-foreground">({productosSinStock.length})</span>
              </div>
              <div className="rounded-2xl border border-k-loss/15 bg-k-loss-muted/15 overflow-hidden divide-y divide-border/40">
                {productosSinStock.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                    <p className="text-sm truncate">{p.nombre}</p>
                    <span className="text-xs text-k-loss shrink-0 ml-3 font-medium">{p.category?.nombre}</span>
                  </div>
                ))}
                {productosSinStock.length > 5 && (
                  <div className="px-4 py-2 text-xs text-muted-foreground">
                    +{productosSinStock.length - 5} más
                  </div>
                )}
              </div>
            </div>
          )}

          {loadingCategorias ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-2xl" />
              ))}
            </div>
          ) : !resumenCategorias || resumenCategorias.length === 0 ? (
            <EmptyState icon={Package} title="Sin productos para este proveedor" />
          ) : (
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3"
              variants={stagger.container}
              initial="hidden"
              animate="show"
            >
              {resumenCategorias.map((c) => (
                <motion.div key={c.id} variants={stagger.item}>
                  <NavCard
                    title={c.nombre}
                    sub={`${c.totalProductos} producto${c.totalProductos === 1 ? "" : "s"}`}
                    icon={Tag}
                    onClick={() => irACategoria(c.id)}
                    badge={
                      esAdmin ? (
                        <span className="text-xs font-semibold tabular-nums text-k-gain shrink-0">
                          {formatearARS(c.gananciaPotencialCentavos)}
                        </span>
                      ) : undefined
                    }
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {/* Modal para crear/editar */}
      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <ProductoForm
              key={editingId ?? `new-${barcodePreset ?? ""}`}
              producto={productoEditing}
              barcodePreset={editingId ? undefined : barcodePreset}
              defaultsNuevo={editingId ? undefined : defaultsNuevo}
              onSuccess={onSuccess}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
