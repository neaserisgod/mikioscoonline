"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { crearProductoAction, editarProductoAction, desactivarProductoAction } from "@/app/actions/productos.actions"
import { formatearARS, redondearPesoArriba } from "@/domain/dinero"

export interface Variante {
  id: string
  nombre: string
  unidadesPorVenta: number
  precioCentavos: number
  costoCentavos: number
  barcode: string | null
  sku: string | null
}

interface VariantesSectionProps {
  dueñoId: string
  categoryId: string
  providerId?: string | null
  locationId?: string | null
  variantes: Variante[]
  esAdmin: boolean
}

interface FormState {
  nombre: string
  unidadesPorVenta: string
  precioPesos: string
  costoPesos: string
  barcode: string
}

const FORM_VACIO: FormState = { nombre: "", unidadesPorVenta: "", precioPesos: "", costoPesos: "", barcode: "" }

/** Alta/edición/baja de variantes desde la edición del producto DUEÑO — nunca
 * aparecen como filas propias en Productos (ver `listar`/`buscar` en
 * producto.service.ts). Categoría/proveedor/heladera se heredan del dueño sin
 * pedirlos de nuevo: así los agrupadores de rentabilidad (proveedor/categoría/
 * heladera) suman la variante junto a su dueño sin lógica extra. */
export function VariantesSection({ dueñoId, categoryId, providerId, locationId, variantes, esAdmin }: VariantesSectionProps) {
  const qc = useQueryClient()
  const [editandoId, setEditandoId] = useState<string | null>(null) // id real o "__nuevo__"
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)

  function refrescar() {
    qc.invalidateQueries({ queryKey: ["productos"] })
    qc.invalidateQueries({ queryKey: ["producto", dueñoId] })
  }

  function abrirNueva() {
    setForm(FORM_VACIO)
    setEditandoId("__nuevo__")
  }

  function abrirEditar(v: Variante) {
    setForm({
      nombre: v.nombre,
      unidadesPorVenta: String(v.unidadesPorVenta),
      precioPesos: v.precioCentavos ? String(v.precioCentavos / 100) : "",
      costoPesos: v.costoCentavos ? String(v.costoCentavos / 100) : "",
      barcode: v.barcode ?? "",
    })
    setEditandoId(v.id)
  }

  function cancelar() {
    setEditandoId(null)
    setForm(FORM_VACIO)
  }

  async function guardar() {
    if (!form.nombre.trim()) return toast.error("El nombre es obligatorio")
    const unidadesPorVenta = Math.round(Number(form.unidadesPorVenta))
    if (!unidadesPorVenta || unidadesPorVenta < 1) return toast.error("Unidades por venta debe ser 1 o más")
    const precioCentavos = redondearPesoArriba(Math.round((Number(form.precioPesos) || 0) * 100))
    if (!precioCentavos || precioCentavos <= 0) return toast.error("El precio es obligatorio")
    const costoCentavos = form.costoPesos
      ? redondearPesoArriba(Math.round((Number(form.costoPesos) || 0) * 100))
      : undefined

    setGuardando(true)
    try {
      const res =
        editandoId === "__nuevo__"
          ? await crearProductoAction({
              nombre: form.nombre.trim(),
              categoryId,
              providerId: providerId ?? undefined,
              locationId: locationId ?? undefined,
              esPesable: false,
              variantOfId: dueñoId,
              unidadesPorVenta,
              precioCentavos,
              costoCentavos,
              barcode: form.barcode.trim() || undefined,
            })
          : await editarProductoAction(editandoId!, {
              nombre: form.nombre.trim(),
              unidadesPorVenta,
              precioCentavos,
              costoCentavos,
              barcode: form.barcode.trim() || undefined,
            })

      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(editandoId === "__nuevo__" ? "Variante creada" : "Variante actualizada")
      refrescar()
      cancelar()
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar esta variante? Dejará de estar disponible para la venta.")) return
    const res = await desactivarProductoAction(id)
    if (!res.ok) return toast.error(res.error)
    toast.success("Variante eliminada")
    refrescar()
  }

  return (
    <div className="space-y-2 rounded-xl border border-border/60 p-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Variantes</Label>
        {editandoId === null && (
          <Button type="button" variant="ghost" size="sm" onClick={abrirNueva} className="h-7 gap-1 text-xs">
            <Plus className="size-3.5" /> Agregar variante
          </Button>
        )}
      </div>

      {variantes.length === 0 && editandoId === null && (
        <p className="text-xs text-muted-foreground">
          Sin variantes. Agregá una si este producto también se vende en otra presentación (ej. "Docena", "Pack x6")
          que comparte el mismo stock.
        </p>
      )}

      <div className="space-y-1.5">
        {variantes.map((v) =>
          editandoId === v.id ? (
            <VarianteForm
              key={v.id}
              form={form}
              setForm={setForm}
              onCancelar={cancelar}
              onGuardar={guardar}
              guardando={guardando}
              esNueva={false}
            />
          ) : (
            <div key={v.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/20 px-2.5 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{v.nombre}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  ×{v.unidadesPorVenta} · {formatearARS(v.precioCentavos)}
                  {esAdmin && v.costoCentavos > 0 && ` · costo ${formatearARS(v.costoCentavos)}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => abrirEditar(v)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-7 text-k-loss" onClick={() => eliminar(v.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          )
        )}

        {editandoId === "__nuevo__" && (
          <VarianteForm form={form} setForm={setForm} onCancelar={cancelar} onGuardar={guardar} guardando={guardando} esNueva />
        )}
      </div>
    </div>
  )
}

function VarianteForm({
  form,
  setForm,
  onCancelar,
  onGuardar,
  guardando,
  esNueva,
}: {
  form: FormState
  setForm: (f: FormState) => void
  onCancelar: () => void
  onGuardar: () => void
  guardando: boolean
  esNueva: boolean
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/10 p-2.5">
      <Input
        placeholder="Nombre (ej. Docena)"
        value={form.nombre}
        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        className="rounded-lg h-8 text-sm"
        autoFocus
      />
      <div className="grid grid-cols-3 gap-2">
        <Input
          type="number"
          min="1"
          step="1"
          placeholder="Factor"
          value={form.unidadesPorVenta}
          onChange={(e) => setForm({ ...form, unidadesPorVenta: e.target.value })}
          className="rounded-lg h-8 text-sm tabular-nums"
        />
        <Input
          type="number"
          min="0"
          step="1"
          placeholder="Precio $"
          value={form.precioPesos}
          onChange={(e) => setForm({ ...form, precioPesos: e.target.value })}
          className="rounded-lg h-8 text-sm tabular-nums"
        />
        <Input
          type="number"
          min="0"
          step="1"
          placeholder="Costo $ (opc.)"
          value={form.costoPesos}
          onChange={(e) => setForm({ ...form, costoPesos: e.target.value })}
          className="rounded-lg h-8 text-sm tabular-nums"
        />
      </div>
      <Input
        placeholder="Código de barras (opcional)"
        value={form.barcode}
        onChange={(e) => setForm({ ...form, barcode: e.target.value })}
        className="rounded-lg h-8 text-sm"
      />
      <div className="flex gap-2">
        <Button type="button" size="sm" className="h-7 flex-1 text-xs" onClick={onGuardar} disabled={guardando}>
          {guardando ? <Loader2 className="size-3.5 animate-spin" /> : esNueva ? "Crear variante" : "Guardar"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancelar}>
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
