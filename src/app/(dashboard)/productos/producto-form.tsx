"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { crearProductoAction, editarProductoAction } from "@/app/actions/productos.actions"
import { resolverTriangulo } from "@/domain/markup"
import { formatearARS, redondearPesoArriba } from "@/domain/dinero"
import { cn, normalizarTexto } from "@/lib/utils"
import { CatalogoBuscador } from "@/components/catalogo-buscador"
import { VariantesSection, type Variante } from "./variantes-section"

const schema = z.object({
  nombre: z.string().min(1, "Requerido"),
  categoryId: z.string().min(1, "Requerido"),
  barcode: z.string().optional(),
  providerId: z.string().optional(),
  locationId: z.string().optional(),
  esPesable: z.boolean(),
  // Pesable: precioCentavos/costoCentavos son "por kg" y stock/stockMinimo son en KG (se convierten a gramos al enviar)
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
    providerId?: string | null
    locationId?: string | null
    category: { nombre: string }
    provider?: { nombre: string } | null
    location?: { nombre: string } | null
    esPesable?: boolean
    precioPorKgCentavos?: number | null
    costoPorKgCentavos?: number | null
    stockGramos?: number | null
    stockMinimoGramos?: number | null
    variantOfId?: string | null
    variantes?: Variante[]
  }
  barcodePreset?: string
  /** Precarga categoría/proveedor al crear (no se usa editando) — viene de en
   * qué card del drill-down de Productos estaba parado el usuario. */
  defaultsNuevo?: { categoryId?: string; providerId?: string }
  onSuccess: () => void
}

interface Categoria {
  id: string
  nombre: string
  markupDefaultBp: number
  markupDefaultTipo: string
  markupDefaultFijoCentavos: number
}

interface Proveedor { id: string; nombre: string }
interface Ubicacion { id: string; nombre: string }

export default function ProductoForm({ producto, barcodePreset, defaultsNuevo, onSuccess }: ProductoFormProps) {
  const isEditing = !!producto
  const { data: session } = useSession()
  const esAdmin = session?.user?.role === "ADMIN"

  const { data: categorias } = useQuery<Categoria[]>({
    queryKey: ["categorias"],
    queryFn: () => fetch("/api/config/categorias").then((r) => r.json()),
    staleTime: 5 * 60_000,
  })

  const { data: proveedores } = useQuery<Proveedor[]>({
    queryKey: ["proveedores"],
    queryFn: () => fetch("/api/config/proveedores").then((r) => r.json()),
    staleTime: 5 * 60_000,
  })

  const { data: ubicaciones } = useQuery<Ubicacion[]>({
    queryKey: ["ubicaciones"],
    queryFn: () => fetch("/api/config/ubicaciones").then((r) => r.json()),
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
      nombre: producto?.nombre ?? "",
      categoryId: producto?.categoryId ?? defaultsNuevo?.categoryId ?? "",
      barcode: producto?.barcode ?? barcodePreset ?? "",
      providerId: producto?.providerId ?? defaultsNuevo?.providerId ?? undefined,
      locationId: producto?.locationId ?? undefined,
      esPesable: producto?.esPesable ?? false,
      precioCentavos: producto
        ? (producto.esPesable ? (producto.precioPorKgCentavos ?? 0) : producto.precioCentavos) / 100
        : undefined,
      costoCentavos: producto
        ? (producto.esPesable ? (producto.costoPorKgCentavos ?? 0) : producto.costoCentavos) / 100
        : undefined,
      stock: producto ? (producto.esPesable ? (producto.stockGramos ?? 0) / 1000 : producto.stock) : 0,
      stockMinimo: producto
        ? (producto.esPesable ? (producto.stockMinimoGramos ?? 0) / 1000 : producto.stockMinimo)
        : 0,
    },
  })

  const categoryId = watch("categoryId")
  const esPesable = watch("esPesable")
  const precioPesos = watch("precioCentavos") ?? 0
  const costoPesos = watch("costoCentavos")

  const catActual = categorias?.find((c) => c.id === categoryId)
  // Fallback to the prop name so SelectValue shows the label even while categorias load
  const categoryDisplayName = catActual?.nombre ?? (isEditing ? producto?.category?.nombre : undefined)

  // Ganancia fija local state (en pesos, para el input en modo FIJO)
  const [gananciaFijaPesos, setGananciaFijaPesos] = useState<string>("")

  // Markup mode: defaults to category's tipo when category is selected/changes.
  // Si el default de la categoría es FIJO, hay que sembrar gananciaFijaPesos
  // desde el precio/costo ya cargados — si no, queda en "" y el efecto de abajo
  // recalcula precio = costo + 0, pisando el precio real del producto.
  const [markupTipo, setMarkupTipo] = useState<"PORCENTUAL" | "FIJO">("PORCENTUAL")
  useEffect(() => {
    if (!catActual) return
    const tipo = (catActual.markupDefaultTipo as "PORCENTUAL" | "FIJO") ?? "PORCENTUAL"
    setMarkupTipo(tipo)
    if (tipo === "FIJO") {
      const precioC = Math.round((Number(precioPesos) || 0) * 100)
      const costoC = Math.round((Number(costoPesos) || 0) * 100)
      if (precioC > 0 && costoC > 0) {
        setGananciaFijaPesos(((precioC - costoC) / 100).toFixed(2))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catActual?.id])

  // Cuando el usuario tipea gananciaFija o cambia el costo, auto-computa precio en modo FIJO
  // El negocio no maneja centavos: el precio computado se redondea para arriba al peso entero.
  useEffect(() => {
    if (markupTipo !== "FIJO") return
    const ganancia = parseFloat(gananciaFijaPesos) || 0
    const costo = Number(costoPesos) || 0
    if (costo > 0 || ganancia !== 0) {
      const precioComputadoC = redondearPesoArriba(Math.round((costo + ganancia) * 100))
      if (precioComputadoC > 0) setValue("precioCentavos", precioComputadoC / 100)
    }
  }, [gananciaFijaPesos, costoPesos, markupTipo])

  // Cuando se cambia a modo FIJO, inicializa gananciaFija desde el triangulo actual
  function handleSetMarkupTipo(tipo: "PORCENTUAL" | "FIJO") {
    setMarkupTipo(tipo)
    if (tipo === "FIJO") {
      const precioC = redondearPesoArriba(Math.round((Number(precioPesos) || 0) * 100))
      const costoC = redondearPesoArriba(Math.round((Number(costoPesos) || 0) * 100))
      if (precioC > 0 && costoC > 0) {
        const ganancia = (precioC - costoC) / 100
        setGananciaFijaPesos(ganancia.toFixed(0))
      }
    }
  }

  // Compute live triangle for display (always from precio + costo) — redondeado
  // para arriba al peso entero, así el preview coincide con lo que se guarda.
  const triangulo = (() => {
    const precioC = redondearPesoArriba(Math.round((Number(precioPesos) || 0) * 100))
    const costoC = costoPesos !== undefined ? redondearPesoArriba(Math.round((Number(costoPesos) || 0) * 100)) : undefined
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
      v !== undefined && !Number.isNaN(v) ? redondearPesoArriba(Math.round(v * 100)) : undefined

    const base = {
      nombre: data.nombre,
      categoryId: data.categoryId,
      barcode: data.barcode || undefined,
      providerId: data.providerId || undefined,
      locationId: data.locationId || undefined,
      esPesable: data.esPesable,
    }

    const payload = data.esPesable
      ? {
          ...base,
          precioPorKgCentavos: centavos(data.precioCentavos),
          costoPorKgCentavos: centavos(data.costoCentavos),
          stockGramos: Math.round(data.stock * 1000),
          stockMinimoGramos: Math.round(data.stockMinimo * 1000),
        }
      : {
          ...base,
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
            initialQuery={barcodePreset}
            onSelect={(item) => {
              setValue("nombre", item.nombre)
              setValue("barcode", item.sku)
              // El catálogo trae "categoria" como texto libre (ej. "GASEOSAS |
              // SPRITE") sin costo/precio/proveedor — solo alcanza para
              // autocompletar la categoría, matcheando el primer segmento
              // contra las categorías ya creadas en el negocio.
              const primerSegmento = normalizarTexto(item.categoria.split("|")[0].trim())
              const match = categorias?.find((c) => normalizarTexto(c.nombre) === primerSegmento)
              if (match) setValue("categoryId", match.id)
            }}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="barcode">Código de barras</Label>
        <Input
          id="barcode"
          {...register("barcode")}
          placeholder="Opcional — dejalo vacío si no tiene"
          className="rounded-xl"
          data-barcode-input
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" autoFocus {...register("nombre")} className="rounded-xl" />
        {errors.nombre && <p className="text-xs text-k-loss">{errors.nombre.message}</p>}
      </div>

      <label className="flex items-center gap-2.5 rounded-xl border border-border/60 px-3 py-2.5 cursor-pointer">
        <Checkbox
          checked={esPesable}
          onCheckedChange={(checked) => setValue("esPesable", checked === true)}
        />
        <span className="text-sm">
          Se vende por peso (kg) — ej. fiambre, queso
        </span>
      </label>

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

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Proveedor</Label>
          <Select
            value={watch("providerId") ?? ""}
            onValueChange={(v) => setValue("providerId", v === "__none__" ? undefined : v ?? undefined)}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Sin proveedor">
                {proveedores?.find((p) => p.id === watch("providerId"))?.nombre ?? (isEditing && producto?.provider?.nombre) ?? undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin proveedor</SelectItem>
              {proveedores?.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Heladera</Label>
          <Select
            value={watch("locationId") ?? ""}
            onValueChange={(v) => setValue("locationId", v === "__none__" ? undefined : v ?? undefined)}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Sin heladera">
                {ubicaciones?.find((u) => u.id === watch("locationId"))?.nombre ?? (isEditing && producto?.location?.nombre) ?? undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin heladera</SelectItem>
              {ubicaciones?.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Precio / Costo / Markup — ADMIN ve el triángulo completo con toggle % / $.
          VENDEDOR solo carga el precio de venta; el costo se estima server-side
          desde el markup default de la categoría (ver crearProductoAction) y
          queda marcado "provisional" hasta que un ADMIN lo corrija. */}
      {!esAdmin ? (
        <div className="space-y-1.5">
          <Label htmlFor="precio">{esPesable ? "Precio por kg ($/kg)" : "Precio de venta ($)"}</Label>
          <Input
            id="precio"
            type="number"
            step="1"
            min="0"
            {...register("precioCentavos", { setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)) })}
            className="rounded-xl tabular-nums"
          />
          {errors.precioCentavos && (
            <p className="text-xs text-k-loss">{errors.precioCentavos.message}</p>
          )}
        </div>
      ) : (
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
              <Label htmlFor="precio" className="text-muted-foreground text-xs">
                {esPesable ? "Precio por kg ($/kg)" : "Precio de venta ($)"}
              </Label>
              <Input
                id="precio"
                type="number"
                step="1"
                min="0"
                {...register("precioCentavos", { setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)) })}
                className="rounded-xl tabular-nums"
              />
              {errors.precioCentavos && (
                <p className="text-xs text-k-loss">{errors.precioCentavos.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="costo" className="text-muted-foreground text-xs">
                {esPesable ? "Costo por kg ($/kg)" : "Costo ($)"}
              </Label>
              <Input
                id="costo"
                type="number"
                step="1"
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
                <Label htmlFor="costo-fijo" className="text-muted-foreground text-xs">
                  {esPesable ? "Costo por kg ($/kg)" : "Costo ($)"}
                </Label>
                <Input
                  id="costo-fijo"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="Opcional"
                  {...register("costoCentavos", { setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)) })}
                  className="rounded-xl tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ganancia-fija" className="text-muted-foreground text-xs">
                  {esPesable ? "Ganancia fija ($ por kg)" : "Ganancia fija ($ por unidad)"}
                </Label>
                <Input
                  id="ganancia-fija"
                  type="number"
                  step="1"
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
                {precioPesos > 0 ? `$${Number(precioPesos).toFixed(0)}` : "—"}
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
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="stock">{esPesable ? "Stock actual (kg)" : "Stock actual"}</Label>
          <Input
            id="stock"
            type="number"
            step={esPesable ? "0.001" : "1"}
            min="0"
            {...register("stock", { setValueAs: (v) => (v === "" || v == null ? 0 : Number(v)) })}
            className="rounded-xl tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stockMinimo">{esPesable ? "Stock mínimo (kg)" : "Stock mínimo"}</Label>
          <Input
            id="stockMinimo"
            type="number"
            step={esPesable ? "0.001" : "1"}
            min="0"
            {...register("stockMinimo", { setValueAs: (v) => (v === "" || v == null ? 0 : Number(v)) })}
            className="rounded-xl tabular-nums"
          />
        </div>
      </div>

      {isEditing && producto && !producto.variantOfId && (
        <VariantesSection
          dueñoId={producto.id}
          categoryId={producto.categoryId}
          providerId={producto.providerId}
          locationId={producto.locationId}
          variantes={producto.variantes ?? []}
          esAdmin={esAdmin}
        />
      )}

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
