"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Plus, Loader2, Truck, Pencil, ArrowRight, ArrowDownLeft, ArrowUpRight, Package, AlertTriangle, PackagePlus, Percent, Eye, EyeOff, Trash2, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { formatearARS } from "@/domain/dinero"
import { cn } from "@/lib/utils"
import { stagger } from "@/lib/motion"
import { Field } from "@/components/config/list-primitives"
import {
  crearProveedorAction, editarProveedorAction,
  desactivarProveedorAction, reactivarProveedorAction, eliminarProveedorAction,
  registrarCompraCuentaCorrienteAction, registrarPagoCuentaCorrienteAction, actualizarPisoReposicionAction,
  aplicarAjusteCostoProveedorAction,
} from "@/app/actions/config.actions"

interface Proveedor {
  id: string; nombre: string; activo: boolean
  saldoCuentaCorrienteCentavos: number
  pisoReposicionCentavos: number
  saldoReposicionCentavos: number
  _count: { products: number }
}
interface StockBajoItem { id: string; sku: string; nombre: string; stock: number; stockMinimo: number }
interface CajaItem { id: string; nombre: string; sesiones: { id: string }[] }
interface ResumenProveedorStock { id: string; valorCostoCentavos: number; valorVentaCentavos: number }
interface ResumenProveedorFinanciero {
  id: string; nombre: string; totalProductos: number; sinStock: number
  gananciaPotencialCentavos: number; valorCostoCentavos: number; valorVentaCentavos: number
  pisoReposicionCentavos: number; saldoReposicionCentavos: number
}
interface FilaRentabilidadProveedor { id: string; ventasCentavos: number }
interface MovimientoCuentaCorriente {
  id: string; tipo: "COMPRA" | "PAGO"; montoCentavos: number; createdAt: string
  caja: { nombre: string } | null
}
interface PedidoLinea {
  id: string; cantidad: number; creadoEn: string
  product: { nombre: string; sku: string }
}

function mesActualRango() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const ultimoDia = new Date(y, d.getMonth() + 1, 0).getDate()
  return { desde: `${y}-${m}-01`, hasta: `${y}-${m}-${String(ultimoDia).padStart(2, "0")}` }
}

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

/** Compartida entre la card (ProveedorFinancieroCard) y el detalle
 * (CuentaCorrienteSheet) — misma cuenta, mismo texto, un solo lugar. */
function recomendacionReposicion(p: { pisoReposicionCentavos: number; saldoReposicionCentavos: number }) {
  if (p.pisoReposicionCentavos === 0) {
    return { texto: "Sin piso de reposición configurado", tono: "muted" as const }
  }
  if (p.saldoReposicionCentavos >= p.pisoReposicionCentavos) {
    return {
      texto: `Podés recomprar (juntaste ${formatearARS(p.saldoReposicionCentavos)} de ${formatearARS(p.pisoReposicionCentavos)})`,
      tono: "gain" as const,
    }
  }
  return {
    texto: `Te falta ${formatearARS(p.pisoReposicionCentavos - p.saldoReposicionCentavos)}`,
    tono: "loss" as const,
  }
}

export default function ProveedoresClient() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<Proveedor[]>({
    queryKey: ["proveedores"],
    queryFn: () => fetch("/api/config/proveedores").then((r) => r.json()),
    staleTime: 30_000,
  })
  // Desglose financiero (invertido/ingreso/ganancia potencial) — solo
  // proveedores ACTIVOS (ver producto.service.ts). Un proveedor inactivo
  // igual tiene su card (con `data`, arriba) para poder reactivarlo, solo que
  // sin estos montos — no tiene sentido calcular inventario "potencial" de
  // algo que no se compra.
  const { data: financiero, isLoading: isLoadingFinanciero } = useQuery<ResumenProveedorFinanciero[]>({
    queryKey: ["productos-resumen-proveedores"],
    queryFn: () => fetch("/api/productos/resumen-proveedores").then((r) => r.json()),
    staleTime: 60_000,
  })

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Proveedor | null>(null)
  const [cuentaProveedor, setCuentaProveedor] = useState<Proveedor | null>(null)
  const [ajustandoProveedor, setAjustandoProveedor] = useState<Proveedor | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["proveedores"] })
    // El desglose financiero (piso/saldo de reposición) vive en la misma
    // tabla Provider — sin esto, crear/editar/desactivar acá no se reflejaba
    // en las cards de arriba hasta el próximo staleTime (60s).
    qc.invalidateQueries({ queryKey: ["productos-resumen-proveedores"] })
  }

  function abrirCrear() { setEditing(null); setSheetOpen(true) }
  function abrirEditar(p: Proveedor) { setEditing(p); setSheetOpen(true) }

  async function toggle(p: Proveedor) {
    setPending(p.id)
    try {
      if (p.activo) await desactivarProveedorAction(p.id)
      else await reactivarProveedorAction(p.id)
      toast.success(p.activo ? `"${p.nombre}" desactivado` : `"${p.nombre}" reactivado`)
      invalidar()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setPending(null) }
  }

  async function eliminar(p: Proveedor) {
    setPending(p.id)
    try {
      await eliminarProveedorAction(p.id)
      toast.success(`"${p.nombre}" eliminado`)
      invalidar()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setPending(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={abrirCrear} className="gap-1.5"><Plus className="size-3.5" /> Nuevo</Button>
      </div>

      {isLoading || isLoadingFinanciero ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      ) : data?.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Truck className="size-8" />
          <p className="text-sm">Sin proveedores todavía</p>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
          initial="hidden"
          animate="show"
          variants={stagger.container}
        >
          {data?.map((p) => (
            <ProveedorFinancieroCard
              key={p.id}
              proveedor={p}
              financiero={financiero?.find((f) => f.id === p.id) ?? null}
              onClick={() => setCuentaProveedor(p)}
            />
          ))}
        </motion.div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <ProveedorForm editing={editing} onSuccess={() => { setSheetOpen(false); invalidar() }} />
        </SheetContent>
      </Sheet>

      <Sheet open={!!ajustandoProveedor} onOpenChange={(v) => !v && setAjustandoProveedor(null)}>
        <SheetContent>
          {ajustandoProveedor && (
            <AjusteCostoSheet
              proveedor={ajustandoProveedor}
              onSuccess={() => { setAjustandoProveedor(null); invalidar() }}
            />
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!cuentaProveedor} onOpenChange={(v) => !v && setCuentaProveedor(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {cuentaProveedor && (
            <ProveedorDetalleDialog
              proveedor={cuentaProveedor}
              isPending={pending === cuentaProveedor.id}
              onSuccess={() => { setCuentaProveedor(null); invalidar() }}
              onEditar={() => { setCuentaProveedor(null); abrirEditar(cuentaProveedor) }}
              onAjustarCostos={() => { setCuentaProveedor(null); setAjustandoProveedor(cuentaProveedor) }}
              onToggleActivo={() => { toggle(cuentaProveedor); setCuentaProveedor(null) }}
              onEliminar={
                cuentaProveedor._count.products === 0
                  ? () => { eliminar(cuentaProveedor); setCuentaProveedor(null) }
                  : undefined
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Card de proveedor (desglose financiero + acceso al detalle) ───────────
// Mismo lenguaje visual que las cards de Inicio (dashboard-client.tsx) —
// rounded-2xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04],
// grillas de 2 columnas para métricas lado a lado, k-gain/k-loss para plata a
// favor/en contra. Clickeable entera: abre "Cuenta corriente" (el detalle/
// gestión del proveedor — ahí viven editar nombre, ajustar costos, desactivar
// y eliminar, ver CuentaCorrienteSheet). Los montos de inversión/ganancia
// potencial vienen de `financiero` (solo proveedores activos, puede ser null
// si el proveedor está inactivo o mientras carga) — sin eso, muestra $0 pero
// la card sigue clickeable para poder reactivarlo.
function ProveedorFinancieroCard({
  proveedor: p, financiero: f, onClick,
}: {
  proveedor: Proveedor
  financiero: ResumenProveedorFinanciero | null
  onClick: () => void
}) {
  const valorCostoCentavos = f?.valorCostoCentavos ?? 0
  const valorVentaCentavos = f?.valorVentaCentavos ?? 0
  const gananciaPotencialCentavos = f?.gananciaPotencialCentavos ?? 0
  const totalProductos = f?.totalProductos ?? p._count.products
  const sinStock = f?.sinStock ?? 0

  const recomendacion = recomendacionReposicion(p)

  return (
    <motion.div
      variants={stagger.item}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick() }
      }}
      className={cn(
        "rounded-2xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] p-5 space-y-3",
        "cursor-pointer transition-colors hover:bg-muted/30",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring",
        !p.activo && "opacity-60"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-[15px] font-semibold tracking-tight truncate">{p.nombre}</p>
          {!p.activo && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-medium shrink-0">
              Inactivo
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {totalProductos} prod.{sinStock > 0 && ` · ${sinStock} sin stock`}
        </span>
      </div>

      {p.saldoCuentaCorrienteCentavos > 0 && (
        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-md bg-k-loss/10 text-k-loss font-medium">
          Debe {formatearARS(p.saldoCuentaCorrienteCentavos)}
        </span>
      )}

      <div>
        <p className="text-xs text-muted-foreground">Invertido a costo</p>
        <p className="text-xl font-semibold tabular-nums mt-1">{formatearARS(valorCostoCentavos)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Si se vende todo</p>
          <p className="text-lg font-semibold tabular-nums mt-1">{formatearARS(valorVentaCentavos)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ganancia potencial</p>
          <p className={cn(
            "text-lg font-semibold tabular-nums mt-1",
            gananciaPotencialCentavos > 0 ? "text-k-gain" : gananciaPotencialCentavos < 0 ? "text-k-loss" : ""
          )}>
            {formatearARS(gananciaPotencialCentavos)}
          </p>
        </div>
      </div>

      <div className="border-t border-border/60 pt-2.5 flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground shrink-0">Reposición</span>
        <span className={cn(
          "font-medium text-right",
          recomendacion.tono === "gain" ? "text-k-gain" : recomendacion.tono === "loss" ? "text-k-loss" : "text-muted-foreground"
        )}>
          {recomendacion.texto}
        </span>
      </div>
    </motion.div>
  )
}

function ProveedorForm({ editing, onSuccess }: { editing: Proveedor | null; onSuccess: () => void }) {
  const [nombre, setNombre] = useState(editing?.nombre ?? "")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) { toast.error("El nombre es obligatorio"); return }
    setIsSubmitting(true)
    try {
      if (editing) {
        await editarProveedorAction(editing.id, { nombre: nombre.trim() })
        toast.success("Proveedor actualizado")
      } else {
        await crearProveedorAction({ nombre: nombre.trim() })
        toast.success("Proveedor creado")
      }
      onSuccess()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setIsSubmitting(false) }
  }

  return (
    <>
      <SheetHeader><SheetTitle>{editing ? "Editar proveedor" : "Nuevo proveedor"}</SheetTitle></SheetHeader>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Nombre" autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : editing ? "Guardar" : "Crear"}
        </Button>
      </form>
    </>
  )
}

interface FilaAjusteCosto {
  id: string; nombre: string; esPesable: boolean
  costoActualCentavos: number; costoNuevoCentavos: number
  precioActualCentavos: number; precioNuevoCentavos: number
}

/** "Subió todo un X%": ajusta el costo de los productos de este proveedor
 * manteniendo el markup de cada uno — nunca aplica nada sin vista previa
 * primero (ver proveedorService.previsualizarAjusteCosto/aplicarAjusteCosto). */
function AjusteCostoSheet({ proveedor, onSuccess }: { proveedor: Proveedor; onSuccess: () => void }) {
  const [porcentajeInput, setPorcentajeInput] = useState("")
  const [porcentajeConfirmado, setPorcentajeConfirmado] = useState<number | null>(null)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: filas, isLoading } = useQuery<FilaAjusteCosto[]>({
    queryKey: ["proveedor-ajuste-costo-preview", proveedor.id, porcentajeConfirmado],
    queryFn: () =>
      fetch(`/api/config/proveedores/${proveedor.id}/ajuste-costo-preview?porcentaje=${porcentajeConfirmado}`).then((r) => r.json()),
    enabled: porcentajeConfirmado !== null,
  })

  function verVistaPrevia(e: React.FormEvent) {
    e.preventDefault()
    const pct = Number(porcentajeInput)
    if (!Number.isFinite(pct) || pct === 0) { toast.error("Ingresá un porcentaje válido (puede ser negativo)"); return }
    setPorcentajeConfirmado(pct)
    setSeleccionados(new Set())
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicialización única desde datos async, no re-render en loop
    if (filas) setSeleccionados(new Set(filas.map((f) => f.id)))
  }, [filas])

  function toggle(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function aplicar() {
    if (porcentajeConfirmado === null) return
    setIsSubmitting(true)
    try {
      const res = await aplicarAjusteCostoProveedorAction(proveedor.id, porcentajeConfirmado, Array.from(seleccionados))
      toast.success(`${res.actualizados} producto${res.actualizados === 1 ? "" : "s"} actualizado${res.actualizados === 1 ? "" : "s"}`)
      onSuccess()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setIsSubmitting(false) }
  }

  return (
    <>
      <SheetHeader><SheetTitle>Ajustar costos — {proveedor.nombre}</SheetTitle></SheetHeader>
      <p className="mt-2 text-xs text-muted-foreground">
        Sube (o baja, con % negativo) el costo de todos los productos de este proveedor, manteniendo el markup
        actual de cada uno — el precio de venta se recalcula solo a partir del costo nuevo.
      </p>

      <form onSubmit={verVistaPrevia} className="mt-4 flex items-end gap-2">
        <Field
          label="Porcentaje (ej. 8 = subió 8%)"
          type="number" step="0.1"
          value={porcentajeInput}
          onChange={(e) => setPorcentajeInput(e.target.value)}
        />
        <Button type="submit" variant="outline">Ver vista previa</Button>
      </form>

      {isLoading && (
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
        </div>
      )}

      {filas && (
        filas.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Ningún producto activo de este proveedor tiene costo cargado.</p>
        ) : (
          <>
            <div className="mt-4 rounded-xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] divide-y divide-border/40 max-h-[45vh] overflow-y-auto">
              {filas.map((f) => (
                <label key={f.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer">
                  <Checkbox checked={seleccionados.has(f.id)} onCheckedChange={() => toggle(f.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{f.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      Costo {formatearARS(f.costoActualCentavos)} → {formatearARS(f.costoNuevoCentavos)}{f.esPesable && "/kg"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground line-through">{formatearARS(f.precioActualCentavos)}</p>
                    <p className="text-sm font-semibold tabular-nums">{formatearARS(f.precioNuevoCentavos)}</p>
                  </div>
                </label>
              ))}
            </div>
            <Button className="w-full mt-4" disabled={seleccionados.size === 0 || isSubmitting} onClick={aplicar}>
              {isSubmitting
                ? <Loader2 className="size-4 animate-spin" />
                : `Aplicar a ${seleccionados.size} producto${seleccionados.size === 1 ? "" : "s"}`}
            </Button>
          </>
        )
      )}
    </>
  )
}

function MontoInlineEdit({ defaultValue, onSave, onCancel }: {
  defaultValue: number; onSave: (pesos: number) => Promise<void>; onCancel: () => void
}) {
  const [pesos, setPesos] = useState(String(defaultValue))
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try { await onSave(Number(pesos) || 0) } finally { setIsSubmitting(false) }
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <input
        type="number" step="0.01" min="0" autoFocus
        value={pesos} onChange={(e) => setPesos(e.target.value)}
        className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <Button type="submit" size="sm" disabled={isSubmitting}>Guardar</Button>
      <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
    </form>
  )
}

function ProveedorDetalleDialog({
  proveedor, onSuccess, onEditar, onAjustarCostos, onToggleActivo, onEliminar, isPending,
}: {
  proveedor: Proveedor
  onSuccess: () => void
  /** Este sheet es ahora el detalle/gestión completo del proveedor (se llega
   * clickeando su card) — estas 4 acciones antes vivían como íconos sueltos
   * en la fila de una lista que ya no existe (ver ProveedorFinancieroCard). */
  onEditar: () => void
  onAjustarCostos: () => void
  onToggleActivo: () => void
  /** undefined si el proveedor tiene productos (mismo criterio que antes: no
   * se puede eliminar un proveedor con catálogo). */
  onEliminar?: () => void
  isPending: boolean
}) {
  const qc = useQueryClient()
  // OJO: /api/config/cajas lista todas las cajas activas (para administrarlas),
  // no cuáles tienen sesión abierta AHORA — para elegir de dónde sale un pago
  // hace falta /api/cajas (el mismo que usa Clientes), si no se puede elegir
  // una caja cerrada y el pago falla recién al confirmar.
  const { data: cajas } = useQuery<CajaItem[]>({
    queryKey: ["cajas-panel"],
    queryFn: () => fetch("/api/cajas").then((r) => r.json()),
    staleTime: 5 * 60_000,
  })
  const { desde, hasta } = mesActualRango()
  const { data: stockProveedores } = useQuery<ResumenProveedorStock[]>({
    queryKey: ["productos-resumen-proveedores"],
    queryFn: () => fetch("/api/productos/resumen-proveedores").then((r) => r.json()),
    staleTime: 60_000,
  })
  const { data: ventasProveedores } = useQuery<FilaRentabilidadProveedor[]>({
    queryKey: ["rentabilidad-proveedor-mes", desde, hasta],
    queryFn: () => fetch(`/api/rentabilidad?por=proveedor&desde=${desde}&hasta=${hasta}`).then((r) => r.json()),
    staleTime: 60_000,
  })
  const { data: movimientos } = useQuery<MovimientoCuentaCorriente[]>({
    queryKey: ["proveedor-movimientos", proveedor.id],
    queryFn: () => fetch(`/api/config/proveedores/${proveedor.id}/movimientos`).then((r) => r.json()),
    staleTime: 30_000,
  })
  const { data: pedidos } = useQuery<PedidoLinea[]>({
    queryKey: ["proveedor-pedidos", proveedor.id],
    queryFn: () => fetch(`/api/config/proveedores/${proveedor.id}/pedidos`).then((r) => r.json()),
    staleTime: 30_000,
  })
  const { data: stockBajo } = useQuery<StockBajoItem[]>({
    queryKey: ["proveedor-stock-bajo", proveedor.id],
    queryFn: () => fetch(`/api/config/proveedores/${proveedor.id}/stock-bajo`).then((r) => r.json()),
    staleTime: 30_000,
  })

  const [modo, setModo] = useState<"pago" | "compra">("pago")
  // El caso más común es pagar la deuda completa — prellenado, no default rígido.
  const [monto, setMonto] = useState(
    proveedor.saldoCuentaCorrienteCentavos > 0 ? String(proveedor.saldoCuentaCorrienteCentavos / 100) : ""
  )
  const [cajaId, setCajaId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editandoPiso, setEditandoPiso] = useState(false)

  const cajasAbiertas = cajas?.filter((c) => c.sesiones.length > 0) ?? []
  const stockDeEste = stockProveedores?.find((p) => p.id === proveedor.id)
  const ventasDeEste = ventasProveedores?.find((p) => p.id === proveedor.id)
  const valorCostoCentavos = stockDeEste?.valorCostoCentavos ?? 0
  const valorVentaCentavos = stockDeEste?.valorVentaCentavos ?? 0
  const gananciaPotencialCentavos = valorVentaCentavos - valorCostoCentavos
  const recomendacion = recomendacionReposicion(proveedor)

  // Si hay una sola caja abierta no tiene sentido obligar a elegirla del dropdown.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- autoselección única de la caja abierta, no re-render en loop
    if (cajasAbiertas.length === 1 && !cajaId) setCajaId(cajasAbiertas[0].id)
  }, [cajasAbiertas, cajaId])

  async function guardarPiso(pesos: number) {
    try {
      await actualizarPisoReposicionAction(proveedor.id, Math.round(pesos * 100))
      toast.success("Piso de reinversión actualizado")
      setEditandoPiso(false)
      onSuccess()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const montoCentavos = Math.round(parseFloat(monto) * 100)
    if (!montoCentavos || montoCentavos <= 0) { toast.error("Ingresá un monto válido"); return }
    if (modo === "pago" && !cajaId) { toast.error("Elegí de qué caja sale el pago"); return }
    setIsSubmitting(true)
    try {
      if (modo === "compra") {
        await registrarCompraCuentaCorrienteAction(proveedor.id, montoCentavos)
        toast.success("Compra a crédito registrada")
      } else {
        await registrarPagoCuentaCorrienteAction(proveedor.id, montoCentavos, cajaId)
        toast.success("Pago registrado")
      }
      qc.invalidateQueries({ queryKey: ["proveedor-movimientos", proveedor.id] })
      onSuccess()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setIsSubmitting(false) }
  }

  return (
    <>
      <DialogHeader className="pr-9">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate">{proveedor.nombre}</DialogTitle>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-md font-medium",
                proveedor.activo ? "bg-k-gain/10 text-k-gain" : "bg-muted text-muted-foreground"
              )}>
                {proveedor.activo ? "Activo" : "Inactivo"}
              </span>
              {proveedor.saldoCuentaCorrienteCentavos > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-k-loss/10 text-k-loss font-medium">
                  Debe {formatearARS(proveedor.saldoCuentaCorrienteCentavos)}
                </span>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="shrink-0" disabled={isPending} />}>
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Más acciones</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onClick={onEditar} className="whitespace-nowrap">
                <Pencil className="size-3.5" /> Editar nombre
              </DropdownMenuItem>
              {proveedor._count.products > 0 && (
                <DropdownMenuItem onClick={onAjustarCostos} className="whitespace-nowrap">
                  <Percent className="size-3.5" /> Ajustar costos
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onToggleActivo} className="whitespace-nowrap">
                {proveedor.activo ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                {proveedor.activo ? "Desactivar" : "Reactivar"}
              </DropdownMenuItem>
              {onEliminar && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    className="whitespace-nowrap"
                    onClick={() => {
                      if (confirm(`¿Eliminar a "${proveedor.nombre}"? Esta acción no se puede deshacer.`)) onEliminar()
                    }}
                  >
                    <Trash2 className="size-3.5" /> Eliminar
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </DialogHeader>

      <div className="space-y-5">
        {/* Sección 1 — Resumen financiero: lidera, mismo lenguaje visual que
        las cards de Inicio/ProveedorFinancieroCard. */}
        <section className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-0.5">
            Resumen financiero
          </p>
          <div className="rounded-xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] p-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Invertido a costo</p>
              <p className="text-2xl font-semibold tabular-nums mt-1">{formatearARS(valorCostoCentavos)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Si se vende todo</p>
                <p className="text-lg font-semibold tabular-nums mt-1">{formatearARS(valorVentaCentavos)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ganancia potencial</p>
                <p className={cn(
                  "text-lg font-semibold tabular-nums mt-1",
                  gananciaPotencialCentavos > 0 ? "text-k-gain" : gananciaPotencialCentavos < 0 ? "text-k-loss" : ""
                )}>
                  {formatearARS(gananciaPotencialCentavos)}
                </p>
              </div>
            </div>
            <div className="border-t border-border/60 pt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Piso de reposición</p>
                  <p className="text-[11px] text-muted-foreground/70">Colchón reservado antes de contar ganancia limpia</p>
                </div>
                {!editandoPiso && (
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-sm font-semibold tabular-nums">{formatearARS(proveedor.pisoReposicionCentavos)}</p>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditandoPiso(true)}>
                      <Pencil className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              {editandoPiso && (
                <MontoInlineEdit
                  defaultValue={proveedor.pisoReposicionCentavos / 100}
                  onSave={guardarPiso}
                  onCancel={() => setEditandoPiso(false)}
                />
              )}
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground shrink-0">Reposición</span>
                <span className={cn(
                  "font-medium text-right",
                  recomendacion.tono === "gain" ? "text-k-gain" : recomendacion.tono === "loss" ? "text-k-loss" : "text-muted-foreground"
                )}>
                  {recomendacion.texto}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground/70">
                Facturaste {formatearARS(ventasDeEste?.ventasCentavos ?? 0)} de este proveedor este mes
              </p>
            </div>
          </div>
        </section>

        {/* Sección 2 — Cuenta corriente */}
        <section className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-0.5">
            Cuenta corriente
          </p>
          <div className="rounded-xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {proveedor.saldoCuentaCorrienteCentavos >= 0 ? "Le debemos" : "Saldo a favor"}
            </p>
            <p className={cn(
              "text-lg font-semibold tabular-nums",
              proveedor.saldoCuentaCorrienteCentavos >= 0 ? "text-k-loss" : "text-k-gain"
            )}>
              {formatearARS(Math.abs(proveedor.saldoCuentaCorrienteCentavos))}
            </p>
          </div>

          <div className="rounded-xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={modo === "pago" ? "default" : "outline"}
                onClick={() => {
                  setModo("pago")
                  if (!monto && proveedor.saldoCuentaCorrienteCentavos > 0) setMonto(String(proveedor.saldoCuentaCorrienteCentavos / 100))
                }}
              >
                Registrar pago
              </Button>
              <Button type="button" variant={modo === "compra" ? "default" : "outline"} onClick={() => setModo("compra")}>Compra a crédito</Button>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              <Field
                label="Monto ($)"
                type="number"
                step="0.01"
                min="0"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
              {modo === "pago" && (
                <div className="space-y-1.5">
                  <Label>Caja de la que sale el pago</Label>
                  <Select value={cajaId} onValueChange={(v) => setCajaId(v ?? "")}>
                    <SelectTrigger><SelectValue placeholder="Elegí una caja" /></SelectTrigger>
                    <SelectContent>
                      {cajasAbiertas.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {cajasAbiertas.length === 0 && (
                    <p className="text-xs text-k-loss">No hay ninguna caja abierta — abrí una para registrar el pago.</p>
                  )}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : modo === "pago" ? "Registrar pago" : "Registrar compra"}
              </Button>
              {modo === "pago" && (
                <p className="text-xs text-muted-foreground">Se crea un egreso real en la caja elegida y baja lo que le debemos.</p>
              )}
              {modo === "compra" && (
                <p className="text-xs text-muted-foreground">Solo sube lo que le debemos — no mueve ninguna caja.</p>
              )}
            </form>
          </div>

          {movimientos && movimientos.length > 0 && (
            <div className="rounded-xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] px-4 py-3 space-y-1.5">
              <p className="text-[11px] text-muted-foreground/70">Movimientos recientes</p>
              {movimientos.slice(0, 6).map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    {m.tipo === "PAGO"
                      ? <ArrowUpRight className="size-3 text-k-gain shrink-0" />
                      : <ArrowDownLeft className="size-3 text-k-loss shrink-0" />}
                    {fechaCorta(m.createdAt)} · {m.tipo === "PAGO" ? `Pago${m.caja ? ` (${m.caja.nombre})` : ""}` : "Compra a crédito"}
                  </span>
                  <span className={cn("font-medium tabular-nums", m.tipo === "PAGO" ? "text-k-gain" : "text-k-loss")}>
                    {formatearARS(m.montoCentavos)}
                  </span>
                </div>
              ))}
              {movimientos.length > 6 && (
                <p className="text-[11px] text-muted-foreground">+{movimientos.length - 6} más</p>
              )}
            </div>
          )}
        </section>

        {/* Sección 3 — Reposición y pedidos */}
        <section className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-0.5">
            Reposición y pedidos
          </p>

          <Link
            href={`/productos?proveedorId=${proveedor.id}`}
            className="flex items-center justify-between rounded-xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] px-4 py-2.5 text-sm hover:bg-muted/30 transition-colors"
          >
            <span className="text-muted-foreground">Ver catálogo de este proveedor</span>
            <ArrowRight className="size-3.5 text-muted-foreground" />
          </Link>

          {stockBajo && stockBajo.length > 0 && (
            <Link
              href={`/productos?tab=pedidos&providerId=${proveedor.id}&sugerir=1`}
              className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm hover:bg-amber-500/15 transition-colors"
            >
              <span className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-3.5 shrink-0" />
                {stockBajo.length} producto{stockBajo.length === 1 ? "" : "s"} con stock bajo — sugerir pedido
              </span>
              <ArrowRight className="size-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
            </Link>
          )}

          {proveedor.saldoReposicionCentavos > 0 && proveedor.saldoReposicionCentavos >= proveedor.pisoReposicionCentavos && (
            <Link
              href={`/productos?tab=pedidos&providerId=${proveedor.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-k-gain/30 bg-k-gain-muted/15 px-4 py-2.5 text-sm hover:bg-k-gain-muted/25 transition-colors"
            >
              <span className="flex items-center gap-2 text-k-gain">
                <PackagePlus className="size-3.5 shrink-0" />
                Ya juntaste {formatearARS(proveedor.saldoReposicionCentavos)} de fondo — buen momento para pedirle
              </span>
              <ArrowRight className="size-3.5 text-k-gain shrink-0" />
            </Link>
          )}

          {pedidos && pedidos.length > 0 && (
            <div className="rounded-xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] px-4 py-3 space-y-1.5">
              <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1.5">
                <Package className="size-3" /> Historial de pedidos (entradas de stock)
              </p>
              {pedidos.slice(0, 6).map((l) => (
                <div key={l.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate">
                    {fechaCorta(l.creadoEn)} · {l.product.nombre}
                  </span>
                  <span className="font-medium tabular-nums shrink-0 ml-2">+{l.cantidad}</span>
                </div>
              ))}
              {pedidos.length > 6 && (
                <p className="text-[11px] text-muted-foreground">+{pedidos.length - 6} más</p>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
