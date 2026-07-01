"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { Plus, Search, AlertTriangle, Package } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { MarkupBadge } from "@/components/ui/markup-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { formatearARS } from "@/domain/dinero"
import { cn } from "@/lib/utils"
import ProductoForm from "./producto-form"

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
  category: { nombre: string; markupDefaultBp: number }
  provider?: { nombre: string } | null
  location?: { nombre: string } | null
  esPesable: boolean
  precioPorKgCentavos: number | null
  costoPorKgCentavos: number | null
  stockGramos: number | null
  stockMinimoGramos: number | null
}

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.02 } } },
  item: {
    hidden: { opacity: 0, y: 4 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 30 } },
  },
}

const PROD_COLS = "lg:grid-cols-[2fr_0.9fr_1fr_1fr_auto_auto]"

export default function ProductosClient() {
  const [q, setQ] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [barcodePreset, setBarcodePreset] = useState<string | undefined>()
  const qc = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Scanner: ?barcode=XXX → abrir form nuevo con barcode prellenado
  // Scanner: ?abrir=ID → abrir form de edición del producto
  useEffect(() => {
    const barcode = searchParams.get("barcode")
    const abrirId = searchParams.get("abrir")
    if (barcode) {
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

  const { data: productos, isLoading } = useQuery<Producto[]>({
    queryKey: ["productos", q],
    queryFn: () =>
      fetch(`/api/productos${q ? `?q=${encodeURIComponent(q)}` : ""}`).then((r) => r.json()),
    staleTime: 30_000,
  })

  const productoEditing = productos?.find((p) => p.id === editingId)

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
    toast.success(editingId ? "Producto actualizado" : "Producto creado")
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Productos</h1>
        <Button onClick={abrirNuevo} size="sm" className="gap-1.5">
          <Plus className="size-3.5" />
          Nuevo
        </Button>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar por nombre, SKU o código de barras..."
          className="pl-9 rounded-xl bg-card border-border/60"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : !productos || productos.length === 0 ? (
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
      ) : (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          {/* Cabecera de tabla — solo desktop */}
          <div className={cn(
            "hidden lg:grid gap-x-4 px-4 py-2 text-xs text-muted-foreground font-medium bg-muted/20 border-b border-border/40",
            PROD_COLS
          )}>
            <span>Nombre</span>
            <span>SKU</span>
            <span>Categoría</span>
            <span className="text-right">Precio</span>
            <span className="text-center">Markup</span>
            <span className="text-right">Stock</span>
          </div>
          <motion.div
            className="divide-y divide-border/40"
            variants={stagger.container}
            initial="hidden"
            animate="show"
          >
            {productos.map((p) => {
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

              return (
                <motion.button
                  key={p.id}
                  variants={stagger.item}
                  type="button"
                  onClick={() => abrirEditar(p.id)}
                  className={cn(
                    "w-full flex items-center lg:grid gap-3 lg:gap-x-4 px-4 py-3 text-left hover:bg-muted/20 transition-colors",
                    PROD_COLS
                  )}
                >
                  {/* Nombre + badges */}
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
                    {/* Subtexto mobile: SKU · Categoría */}
                    <p className="text-xs text-muted-foreground lg:hidden">
                      {p.sku}{p.category && ` · ${p.category.nombre}`}
                    </p>
                  </div>

                  {/* SKU — solo desktop */}
                  <p className="hidden lg:block text-sm text-muted-foreground truncate">{p.sku}</p>

                  {/* Categoría — solo desktop */}
                  <p className="hidden lg:block text-sm text-muted-foreground truncate">
                    {p.category?.nombre ?? "—"}
                  </p>

                  {/* Precio — solo desktop */}
                  <p className="hidden lg:block text-sm font-semibold tabular-nums text-right">
                    {formatearARS(precioDisplay)}{p.esPesable && "/kg"}
                  </p>

                  {/* Mobile: precio + markup + stock agrupados a la derecha */}
                  <div className="text-right shrink-0 space-y-0.5 lg:hidden">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatearARS(precioDisplay)}{p.esPesable && "/kg"}
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <MarkupBadge markupBp={markupBp} />
                      <span className={cn(
                        "text-xs tabular-nums",
                        esBajo ? "text-k-loss" : "text-muted-foreground"
                      )}>
                        {stockDisplay} {stockUnidad}
                      </span>
                    </div>
                  </div>

                  {/* Markup badge — solo desktop */}
                  <div className="hidden lg:flex justify-center items-center">
                    <MarkupBadge markupBp={markupBp} />
                  </div>

                  {/* Stock — solo desktop */}
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
      )}

      {/* Sheet para crear/editar */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? "Editar producto" : "Nuevo producto"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <ProductoForm
              key={editingId ?? `new-${barcodePreset ?? ""}`}
              producto={productoEditing}
              barcodePreset={editingId ? undefined : barcodePreset}
              onSuccess={onSuccess}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
