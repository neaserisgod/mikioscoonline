"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery } from "@tanstack/react-query"
import { Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { crearProductoAction, editarProductoAction } from "@/app/actions/productos.actions"
import { resolverTriangulo } from "@/domain/markup"
import { formatearARS } from "@/domain/dinero"
import { cn } from "@/lib/utils"
import { CatalogoBuscador } from "@/components/catalogo-buscador"

const schema = z.object({
  sku: z.string().min(1, "Requerido"),
  nombre: z.string().min(1, "Requerido"),
  categoryId: z.string().min(1, "Requerido"),
  barcode: z.string().optional(),
  precioCentavos: z.number().min(1, "Requerido"),
  costoCentavos: z.number().optional(),
  stock: z.number().min(0),
  stockMinimo: z.number().min(0),
})

type FormData = z.infer<typeof schema>

interface ProductoFormProps {
  producto?: {
    id: string
    sku: string
    nombre: string
    precioCentavos: number
    costoCentavos: number
    stock: number
    stockMinimo: number
    barcode?: string | null
    categoryId: string
    category: { nombre: string }
  }
  barcodePreset?: string
  onSuccess: () => void
}

interface Categoria {
  id: string
  nombre: string
  markupDefaultBp: number
  markupDefaultTipo: string
  markupDefaultFijoCentavos: number
}

export default function ProductoForm({ producto, barcodePreset, onSuccess }: ProductoFormProps) {
  const isEditing = !!producto

  const { data: categorias } = useQuery<Categoria[]>({
    queryKey: ["categorias"],
    queryFn: () => fetch("/api/config/categorias").then((r) => r.json()),
    staleTime: 5 * 60_000,
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: producto?.sku ?? "",
      nombre: producto?.nombre ?? "",
      categoryId: producto?.categoryId ?? "",
      barcode: producto?.barcode ?? barcodePreset ?? "",
      precioCentavos: producto ? producto.precioCentavos / 100 : undefined,
      costoCentavos: producto ? producto.costoCentavos / 100 : undefined,
      stock: producto?.stock ?? 0 as number,
      stockMinimo: producto?.stockMinimo ?? 0 as number,
    },
  })

  const categoryId = watch("categoryId")
  const precioPesos = watch("precioCentavos") ?? 0
  const costoPesos = watch("costoCentavos")

  const catActual = categorias?.find((c) => c.id === categoryId)
  // Fallback to the prop name so SelectValue shows the label even while categorias load
  const categoryDisplayName = catActual?.nombre ?? (isEditing ? producto?.category?.nombre : undefined)

  // Markup mode: defaults to category's tipo when category is selected/changes
  const [markupTipo, setMarkupTipo] = useState<"PORCENTUAL" | "FIJO">("PORCENTUAL")
  useEffect(() => {
    if (catActual) {
      setMarkupTipo((catActual.markupDefaultTipo as "PORCENTUAL" | "FIJO") ?? "PORCENTUAL")
    }
  }, [catActual?.id])

  // Ganancia fija local state (en pesos, para el input en modo FIJO)
  const [gananciaFijaPesos, setGananciaFijaPesos] = useState<string>("")

  // Cuando el usuario tipea gananciaFija o cambia el costo, auto-computa precio en modo FIJO
  useEffect(() => {
    if (markupTipo !== "FIJO") return
    const ganancia = parseFloat(gananciaFijaPesos) || 0
    const costo = Number(costoPesos) || 0
    if (costo > 0 || ganancia !== 0) {
      const precioComputado = costo + ganancia
      if (precioComputado > 0) setValue("precioCentavos", precioComputado)
    }
  }, [gananciaFijaPesos, costoPesos, markupTipo])

  // Cuando se cambia a modo FIJO, inicializa gananciaFija desde el triangulo actual
  function handleSetMarkupTipo(tipo: "PORCENTUAL" | "FIJO") {
    setMarkupTipo(tipo)
    if (tipo === "FIJO") {
      const precioC = Math.round((Number(precioPesos) || 0) * 100)
      const costoC = Math.round((Number(costoPesos) || 0) * 100)
      if (precioC > 0 && costoC > 0) {
        const ganancia = (precioC - costoC) / 100
        setGananciaFijaPesos(ganancia.toFixed(2))
      }
    }
  }

  // Compute live triangle for display (always from precio + costo)
  const triangulo = (() => {
    const precioC = Math.round((Number(precioPesos) || 0) * 100)
    const costoC = costoPesos !== undefined ? Math.round((Number(costoPesos) || 0) * 100) : undefined
    if (precioC <= 0) return null
    try {
      return resolverTriangulo({
        costoCentavos: costoC && costoC > 0 ? costoC : undefined,
        precioCentavos: precioC,
        markupDefaultBp: catActual?.markupDefaultBp ?? 0,
        markupDefaultTipo: (catActual?.markupDefaultTipo as "PORCENTUAL" | "FIJO") ?? "PORCENTUAL",
        markupDefaultFijoCentavos: catActual?.markupDefaultFijoCentavos ?? 0,
      })
    } catch {
      return null
    }
  })()

  async function onSubmit(data: FormData) {
    const centavos = (v?: number) =>
      v !== undefined && !Number.isNaN(v) ? Math.round(v * 100) : undefined

    const payload = {
      sku: data.sku,
      nombre: data.nombre,
      categoryId: data.categoryId,
      barcode: data.barcode || undefined,
      precioCentavos: centavos(data.precioCentavos),
      costoCentavos: centavos(data.costoCentavos),
      stock: data.stock,
      stockMinimo: data.stockMinimo,
    }

    try {
      const res = isEditing
        ? await editarProductoAction(producto.id, payload)
        : await crearProductoAction(payload)

      if (res.ok) {
        onSuccess()
      } else {
        toast.error(res.error)
      }
    } catch (e) {
      // Red/servidor caído u otro fallo inesperado fuera de la acción
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el producto")
    }
  }

  const markupPct = triangulo ? (triangulo.markupBp / 100).toFixed(1) : null
  const gananciaDisplay = triangulo ? formatearARS(triangulo.gananciaFijaCentavos) : null
  const margenNegativo = triangulo?.margenNegativo ?? false

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {!isEditing && (
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">Buscar en catálogo</Label>
          <CatalogoBuscador
            onSelect={(item) => {
              setValue("nombre", item.nombre)
              setValue("barcode", item.sku)
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" {...register("sku")} className="rounded-xl" />
          {errors.sku && <p className="text-xs text-k-loss">{errors.sku.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="barcode">Código de barras</Label>
          <Input id="barcode" {...register("barcode")} className="rounded-xl" data-barcode-input />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" {...register("nombre")} className="rounded-xl" />
        {errors.nombre && <p className="text-xs text-k-loss">{errors.nombre.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Categoría</Label>
        <Select
          key={categorias ? "loaded" : "loading"}
          value={watch("categoryId")}
          onValueChange={(v) => setValue("categoryId", v ?? "")}
        >
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder="Seleccionar...">{categoryDisplayName}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categorias?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.categoryId && <p className="text-xs text-k-loss">{errors.categoryId.message}</p>}
      </div>

      {/* Precio / Costo / Markup con toggle % / $ */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Precio y costo</Label>
          <div className="flex rounded-lg border border-border/60 overflow-hidden text-xs">
            {(["PORCENTUAL", "FIJO"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleSetMarkupTipo(t)}
                className={cn(
                  "px-2.5 py-1 font-medium transition-colors",
                  markupTipo === t
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "PORCENTUAL" ? "%" : "$"}
              </button>
            ))}
          </div>
        </div>

        {markupTipo === "PORCENTUAL" ? (
          /* Modo porcentual: precio + costo, markup se muestra como lectura */
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="precio" className="text-muted-foreground text-xs">Precio de venta ($)</Label>
              <Input
                id="precio"
                type="number"
                step="0.01"
                min="0"
                {...register("precioCentavos", { setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)) })}
                className="rounded-xl tabular-nums"
              />
              {errors.precioCentavos && (
                <p className="text-xs text-k-loss">{errors.precioCentavos.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="costo" className="text-muted-foreground text-xs">Costo ($)</Label>
              <Input
                id="costo"
                type="number"
                step="0.01"
                min="0"
                placeholder="Opcional"
                {...register("costoCentavos", { setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)) })}
                className="rounded-xl tabular-nums"
              />
            </div>
          </div>
        ) : (
          /* Modo fijo: costo + ganancia fija → precio auto-computado */
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="costo-fijo" className="text-muted-foreground text-xs">Costo ($)</Label>
                <Input
                  id="costo-fijo"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Opcional"
                  {...register("costoCentavos", { setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)) })}
                  className="rounded-xl tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ganancia-fija" className="text-muted-foreground text-xs">Ganancia fija ($ por unidad)</Label>
                <Input
                  id="ganancia-fija"
                  type="number"
                  step="0.01"
                  value={gananciaFijaPesos}
                  onChange={(e) => setGananciaFijaPesos(e.target.value)}
                  className="rounded-xl tabular-nums"
                  placeholder="500"
                />
              </div>
            </div>
            {/* Precio computado (read-only display + hidden field) */}
            <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground text-xs">Precio de venta (calculado)</span>
              <span className="font-semibold tabular-nums">
                {precioPesos > 0 ? `$${Number(precioPesos).toFixed(2)}` : "—"}
              </span>
            </div>
            {errors.precioCentavos && (
              <p className="text-xs text-k-loss">{errors.precioCentavos.message}</p>
            )}
          </div>
        )}

        {/* Lectura dual — siempre que haya triangulo */}
        {triangulo && (
          <div className={cn(
            "rounded-xl px-3 py-2.5 text-sm flex items-center gap-2",
            margenNegativo
              ? "bg-k-loss/8 border border-k-loss/20"
              : "bg-muted/30 border border-border/40"
          )}>
            {margenNegativo && (
              <AlertTriangle className="size-3.5 text-k-loss shrink-0" />
            )}
            <div className="flex-1 flex items-center gap-3 flex-wrap">
              {markupTipo === "PORCENTUAL" ? (
                <>
                  <span className={cn("font-semibold tabular-nums", margenNegativo ? "text-k-loss" : "")}>
                    {markupPct}% markup
                  </span>
                  <span className="text-muted-foreground text-xs">≈ {gananciaDisplay} ganancia</span>
                </>
              ) : (
                <>
                  <span className={cn("font-semibold tabular-nums", margenNegativo ? "text-k-loss" : "")}>
                    {gananciaDisplay} ganancia
                  </span>
                  <span className="text-muted-foreground text-xs">≈ {markupPct}% markup</span>
                </>
              )}
              {margenNegativo && (
                <span className="text-xs font-medium text-k-loss ml-auto">margen negativo</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="stock">Stock actual</Label>
          <Input
            id="stock"
            type="number"
            min="0"
            {...register("stock", { setValueAs: (v) => (v === "" || v == null ? 0 : Number(v)) })}
            className="rounded-xl tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stockMinimo">Stock mínimo</Label>
          <Input
            id="stockMinimo"
            type="number"
            min="0"
            {...register("stockMinimo", { setValueAs: (v) => (v === "" || v == null ? 0 : Number(v)) })}
            className="rounded-xl tabular-nums"
          />
        </div>
      </div>

      <Button type="submit" className="w-full rounded-xl" disabled={isSubmitting}>
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : isEditing ? (
          "Guardar cambios"
        ) : (
          "Crear producto"
        )}
      </Button>
    </form>
  )
}
