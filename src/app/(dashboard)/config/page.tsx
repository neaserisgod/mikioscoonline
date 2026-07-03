"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus, Pencil, Trash2, EyeOff, Eye, ChevronUp, ChevronDown,
  Star, Tag, Truck, Archive, CreditCard, Receipt,
  Settings2, Check, X, Loader2,
  Building2, Users, Database, Shield, Download, Wallet,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSession } from "next-auth/react"
import { Skeleton } from "@/components/ui/skeleton"
import { formatearARS } from "@/domain/dinero"
import { cn } from "@/lib/utils"
import {
  crearCategoriaAction, editarCategoriaAction,
  desactivarCategoriaAction, reactivarCategoriaAction, eliminarCategoriaAction,
  crearProveedorAction, editarProveedorAction,
  desactivarProveedorAction, reactivarProveedorAction, eliminarProveedorAction,
  crearUbicacionAction, editarUbicacionAction,
  desactivarUbicacionAction, reactivarUbicacionAction, eliminarUbicacionAction,
  crearMedioPagoAction, editarMedioPagoAction,
  desactivarMedioPagoAction, reactivarMedioPagoAction,
  setDefaultMedioPagoAction, moverOrdenMedioPagoAction,
  crearGastoFijoAction, editarGastoFijoAction,
  actualizarMontoGastoFijoAction, desactivarGastoFijoAction, reactivarGastoFijoAction,
  actualizarNegocioAction,
  crearUsuarioAction, desactivarUsuarioAction, reactivarUsuarioAction, cambiarRolUsuarioAction,
} from "@/app/actions/config.actions"
import {
  crearCajaAction, editarCajaAction,
  desactivarCajaAction, reactivarCajaAction, asignarCategoriasCajaAction,
} from "@/app/actions/caja.actions"
import { resetearOnboardingAction } from "@/app/actions/onboarding.actions"

// ─── Types ────────────────────────────────────────────────────────────────────

type SeccionId =
  | "negocio"
  | "categorias" | "proveedores" | "heladeras"
  | "medios-pago" | "gastos-fijos"
  | "cajas"
  | "operacion" | "usuarios" | "datos"

interface Categoria {
  id: string; nombre: string; markupDefaultBp: number; activo: boolean
  markupDefaultTipo: string; markupDefaultFijoCentavos: number
  _count: { products: number }
}
interface Proveedor {
  id: string; nombre: string; activo: boolean
  _count: { products: number }
}
interface Ubicacion {
  id: string; nombre: string; activo: boolean
  _count: { products: number }
}
interface MedioPago {
  id: string; nombre: string; comisionBp: number
  esEfectivo: boolean; esMercadoPago: boolean
  activo: boolean; esDefault: boolean; orden: number
  cajaId: string | null
  recargoTipo: string; recargoVirtualBp: number; recargoVirtualFijoCentavos: number
  mpExternalPosId: string | null
  mpTerminalId: string | null
}

type TipoPago = "efectivo" | "mercadopago" | "digital"

function tipoFromMedio(m: { esEfectivo: boolean; esMercadoPago: boolean }): TipoPago {
  if (m.esEfectivo) return "efectivo"
  if (m.esMercadoPago) return "mercadopago"
  return "digital"
}

function flagsFromTipo(tipo: TipoPago) {
  return {
    esEfectivo: tipo === "efectivo",
    esMercadoPago: tipo === "mercadopago",
  }
}

const TIPO_LABELS: Record<TipoPago, string> = {
  efectivo: "Efectivo",
  mercadopago: "MercadoPago",
  digital: "Transferencia / QR",
}
interface CajaItem {
  id: string; nombre: string; esPrincipal: boolean; activo: boolean
  orden: number
  _count: { categories: number }
  sesiones: { id: string; fondoInicialCentavos: number; fechaApertura: string; abiertaPor: { nombre: string } }[]
  categories: { id: string; nombre: string }[]
}
interface Organizacion {
  id: string; nombre: string; cuit: string | null; condicionIva: string | null
  puntoDeVenta: number | null; stockMinimoDefault: number
}
interface Usuario {
  id: string; nombre: string; email: string; role: "ADMIN" | "VENDEDOR"
  activo: boolean; createdAt: string
}
interface GastoFijo {
  id: string; nombre: string; activo: boolean
  montos: { id: string; mesAnio: string; montoCentavos: number }[]
}

// ─── Navegación ───────────────────────────────────────────────────────────────

const SECCIONES: { id: SeccionId; label: string; icon: React.ElementType; group?: string }[] = [
  { id: "negocio",     label: "Negocio",        icon: Building2,  group: "General" },
  { id: "cajas",       label: "Cajas",          icon: Wallet,     group: "General" },
  { id: "categorias",  label: "Categorías",     icon: Tag,        group: "Catálogo" },
  { id: "proveedores", label: "Proveedores",    icon: Truck,      group: "Catálogo" },
  { id: "heladeras",   label: "Heladeras",      icon: Archive,    group: "Catálogo" },
  { id: "medios-pago", label: "Medios de pago", icon: CreditCard, group: "Finanzas" },
  { id: "gastos-fijos",label: "Gastos fijos",   icon: Receipt,    group: "Finanzas" },
  { id: "operacion",   label: "Operación",      icon: Settings2,  group: "Sistema" },
  { id: "usuarios",    label: "Usuarios",       icon: Users,      group: "Sistema" },
  { id: "datos",       label: "Datos",          icon: Database,   group: "Sistema" },
]

// ─── Hook genérico ────────────────────────────────────────────────────────────

function useConfig<T>(endpoint: string) {
  return useQuery<T>({
    queryKey: ["config", endpoint],
    queryFn: () => fetch(`/api/config/${endpoint}`).then((r) => r.json()),
    staleTime: 60_000,
  })
}

// ─── Componentes compartidos ──────────────────────────────────────────────────

function Field({ label, error, ...props }: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input {...props} className={cn("rounded-xl", props.className)} />
      {error && <p className="text-xs text-k-loss">{error}</p>}
    </div>
  )
}

function StatusBadge({ activo, count }: { activo: boolean; count?: number }) {
  if (!activo) return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
      Inactivo
    </span>
  )
  if (count !== undefined) return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
      {count} prod.
    </span>
  )
  return null
}

function ActionRow({
  primary, secondary, badge, activo, onEdit, onToggle, onDelete, deleteLabel, isPending,
}: {
  primary: string
  secondary?: string
  badge?: React.ReactNode
  activo: boolean
  onEdit?: () => void
  onToggle: () => void
  onDelete?: () => void
  deleteLabel?: string
  isPending?: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className={cn("px-4 py-3 flex items-center gap-3", !activo && "opacity-60")}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{primary}</p>
          {badge}
        </div>
        {secondary && <p className="text-xs text-muted-foreground">{secondary}</p>}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {isPending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}

        {onEdit && !isPending && (
          <Button variant="ghost" size="icon-sm" onClick={onEdit}>
            <Pencil className="size-3.5" />
          </Button>
        )}

        {/* Toggle activo / desactivar */}
        {!isPending && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            title={activo ? "Desactivar" : "Reactivar"}
          >
            {activo ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
        )}

        {/* Eliminar (hard-delete) solo si hay callback */}
        {onDelete && !isPending && !confirmDelete && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setConfirmDelete(true)}
            title={deleteLabel ?? "Eliminar"}
            className="text-k-loss hover:text-k-loss"
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
        {onDelete && confirmDelete && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-k-loss font-medium">¿Eliminar?</span>
            <Button variant="ghost" size="icon-sm" onClick={() => { onDelete(); setConfirmDelete(false) }} className="text-k-loss">
              <Check className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDelete(false)}>
              <X className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionShell({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function ListCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card divide-y divide-border/40 overflow-hidden">
      {children}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ConfigPage() {
  const [seccion, setSeccion] = useState<SeccionId>("negocio")
  const qc = useQueryClient()

  function invalidate(key?: string) {
    qc.invalidateQueries({ queryKey: key ? ["config", key] : ["config"] })
  }

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-medium">Configuración</h1>

      <div className="flex flex-col lg:grid lg:grid-cols-[200px_1fr] lg:gap-6">
        {/* ── Navegación lateral ─────────────────────────────────────────────── */}
        <nav className="lg:sticky lg:top-4">
          {/* Mobile: pills horizontales */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {SECCIONES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSeccion(s.id)}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                  seccion === s.id
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <s.icon className="size-3.5" />
                {s.label}
              </button>
            ))}
          </div>

          {/* Desktop: lista vertical con grupos */}
          <div className="hidden lg:flex flex-col gap-0.5">
            {SECCIONES.map((s, i) => {
              const prevGroup = i > 0 ? SECCIONES[i - 1].group : null
              const showGroupLabel = s.group && s.group !== prevGroup
              return (
                <div key={s.id}>
                  {showGroupLabel && (
                    <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest px-2 pt-3 pb-1">
                      {s.group}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setSeccion(s.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-colors text-left",
                      seccion === s.id
                        ? "bg-foreground/8 text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    <s.icon className={cn("size-4 shrink-0", seccion === s.id ? "opacity-100" : "opacity-60")} />
                    {s.label}
                  </button>
                </div>
              )
            })}
          </div>
        </nav>

        {/* ── Panel de contenido ─────────────────────────────────────────────── */}
        <div className="mt-4 lg:mt-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={seccion}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              {seccion === "negocio"     && <NegocioSection    onMutate={() => invalidate("negocio")} />}
              {seccion === "cajas"       && <CajasSection      onMutate={() => invalidate("cajas")} />}
              {seccion === "categorias"  && <CategoriasSection  onMutate={() => invalidate("categorias")} />}
              {seccion === "proveedores" && <ProveedoresSection onMutate={() => invalidate("proveedores")} />}
              {seccion === "heladeras"   && <HeladerasSection   onMutate={() => invalidate("ubicaciones")} />}
              {seccion === "medios-pago" && <MediosPagoSection  onMutate={() => invalidate("medios-pago")} />}
              {seccion === "gastos-fijos"&& <GastosFijosSection onMutate={() => invalidate("gastos-fijos")} />}
              {seccion === "operacion"   && <OperacionSection />}
              {seccion === "usuarios"    && <UsuariosSection    onMutate={() => invalidate("usuarios")} />}
              {seccion === "datos"       && <DatosSection />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORÍAS
// ═══════════════════════════════════════════════════════════════════════════════

const categoriaSchema = z.object({
  nombre: z.string().min(1, "Requerido"),
  markupDefaultTipo: z.enum(["PORCENTUAL", "FIJO"]),
  markupDefaultBp: z.number().min(0, "Mínimo 0"),
  markupDefaultFijoCentavos: z.number().min(0, "Mínimo 0"),
})
type CategoriaForm = z.infer<typeof categoriaSchema>

function CategoriasSection({ onMutate }: { onMutate: () => void }) {
  const { data, isLoading } = useConfig<Categoria[]>("categorias")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Categoria | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<CategoriaForm>({
    resolver: zodResolver(categoriaSchema),
    defaultValues: { markupDefaultTipo: "PORCENTUAL", markupDefaultBp: 0, markupDefaultFijoCentavos: 0 },
  })
  const markupTipo = watch("markupDefaultTipo")

  function abrirCrear() {
    setEditing(null)
    reset({ nombre: "", markupDefaultTipo: "PORCENTUAL", markupDefaultBp: 0, markupDefaultFijoCentavos: 0 })
    setSheetOpen(true)
  }
  function abrirEditar(c: Categoria) {
    setEditing(c)
    reset({
      nombre: c.nombre,
      markupDefaultTipo: (c.markupDefaultTipo as "PORCENTUAL" | "FIJO") ?? "PORCENTUAL",
      markupDefaultBp: c.markupDefaultBp / 100,
      markupDefaultFijoCentavos: c.markupDefaultFijoCentavos / 100,
    })
    setSheetOpen(true)
  }

  async function onSubmit(data: CategoriaForm) {
    try {
      const payload = {
        nombre: data.nombre,
        markupDefaultTipo: data.markupDefaultTipo,
        markupDefaultBp: data.markupDefaultTipo === "PORCENTUAL" ? Math.round(data.markupDefaultBp * 100) : 0,
        markupDefaultFijoCentavos: data.markupDefaultTipo === "FIJO" ? Math.round(data.markupDefaultFijoCentavos * 100) : 0,
      }
      if (editing) {
        await editarCategoriaAction(editing.id, payload)
        toast.success("Categoría actualizada")
      } else {
        await crearCategoriaAction(payload)
        toast.success("Categoría creada")
      }
      setSheetOpen(false)
      onMutate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error")
    }
  }

  async function toggle(c: Categoria) {
    setPending(c.id)
    try {
      if (c.activo) {
        await desactivarCategoriaAction(c.id)
        toast.success(`"${c.nombre}" desactivada`)
      } else {
        await reactivarCategoriaAction(c.id)
        toast.success(`"${c.nombre}" reactivada`)
      }
      onMutate()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setPending(null) }
  }

  async function eliminar(c: Categoria) {
    setPending(c.id)
    try {
      await eliminarCategoriaAction(c.id)
      toast.success(`"${c.nombre}" eliminada`)
      onMutate()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setPending(null) }
  }

  function markupSecondary(c: Categoria) {
    if (c.markupDefaultTipo === "FIJO") {
      return `Ganancia default: $${(c.markupDefaultFijoCentavos / 100).toFixed(2)} fijos`
    }
    return `Markup default: ${(c.markupDefaultBp / 100).toFixed(1)}%`
  }

  return (
    <SectionShell
      title="Categorías"
      action={
        <Button size="sm" onClick={abrirCrear} className="gap-1.5">
          <Plus className="size-3.5" /> Nueva
        </Button>
      }
    >
      {isLoading ? <SkeletonList /> : (
        <ListCard>
          {data?.length === 0 && <EmptyRow label="Sin categorías" />}
          {data?.map((c) => (
            <ActionRow
              key={c.id}
              primary={c.nombre}
              secondary={markupSecondary(c)}
              badge={<StatusBadge activo={c.activo} count={c.activo ? c._count.products : undefined} />}
              activo={c.activo}
              onEdit={() => abrirEditar(c)}
              onToggle={() => toggle(c)}
              onDelete={c._count.products === 0 ? () => eliminar(c) : undefined}
              deleteLabel="Eliminar (sin productos)"
              isPending={pending === c.id}
            />
          ))}
        </ListCard>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? "Editar categoría" : "Nueva categoría"}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <Field label="Nombre" {...register("nombre")} error={errors.nombre?.message} />

            <div className="space-y-1.5">
              <Label>Modo de markup default</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["PORCENTUAL", "FIJO"] as const).map((t) => (
                  <button
                    key={t} type="button"
                    onClick={() => setValue("markupDefaultTipo", t)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                      markupTipo === t
                        ? "border-foreground bg-foreground/8 text-foreground"
                        : "border-border/60 text-muted-foreground hover:bg-muted/20"
                    )}
                  >
                    {t === "PORCENTUAL" ? "Porcentaje (%)" : "Monto fijo ($)"}
                  </button>
                ))}
              </div>
            </div>

            {markupTipo === "PORCENTUAL" ? (
              <Field
                label="Markup default (%)"
                type="number" step="0.1" min="0"
                {...register("markupDefaultBp", { valueAsNumber: true })}
                error={errors.markupDefaultBp?.message}
              />
            ) : (
              <Field
                label="Ganancia fija default ($ por unidad)"
                type="number" step="0.01" min="0"
                {...register("markupDefaultFijoCentavos", { valueAsNumber: true })}
                error={errors.markupDefaultFijoCentavos?.message}
              />
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : editing ? "Guardar cambios" : "Crear"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </SectionShell>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVEEDORES
// ═══════════════════════════════════════════════════════════════════════════════

function ProveedoresSection({ onMutate }: { onMutate: () => void }) {
  const { data, isLoading } = useConfig<Proveedor[]>("proveedores")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Proveedor | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<{ nombre: string }>({
    resolver: zodResolver(z.object({ nombre: z.string().min(1, "Requerido") })),
  })

  function abrirCrear() { setEditing(null); reset({ nombre: "" }); setSheetOpen(true) }
  function abrirEditar(p: Proveedor) { setEditing(p); reset({ nombre: p.nombre }); setSheetOpen(true) }

  async function onSubmit({ nombre }: { nombre: string }) {
    try {
      if (editing) {
        await editarProveedorAction(editing.id, { nombre })
        toast.success("Proveedor actualizado")
      } else {
        await crearProveedorAction({ nombre })
        toast.success("Proveedor creado")
      }
      setSheetOpen(false)
      onMutate()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
  }

  async function toggle(p: Proveedor) {
    setPending(p.id)
    try {
      if (p.activo) await desactivarProveedorAction(p.id)
      else await reactivarProveedorAction(p.id)
      toast.success(p.activo ? `"${p.nombre}" desactivado` : `"${p.nombre}" reactivado`)
      onMutate()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setPending(null) }
  }

  async function eliminar(p: Proveedor) {
    setPending(p.id)
    try {
      await eliminarProveedorAction(p.id)
      toast.success(`"${p.nombre}" eliminado`)
      onMutate()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setPending(null) }
  }

  return (
    <SectionShell
      title="Proveedores"
      action={<Button size="sm" onClick={abrirCrear} className="gap-1.5"><Plus className="size-3.5" /> Nuevo</Button>}
    >
      {isLoading ? <SkeletonList /> : (
        <ListCard>
          {data?.length === 0 && <EmptyRow label="Sin proveedores" />}
          {data?.map((p) => (
            <ActionRow
              key={p.id}
              primary={p.nombre}
              badge={<StatusBadge activo={p.activo} count={p.activo ? p._count.products : undefined} />}
              activo={p.activo}
              onEdit={() => abrirEditar(p)}
              onToggle={() => toggle(p)}
              onDelete={p._count.products === 0 ? () => eliminar(p) : undefined}
              isPending={pending === p.id}
            />
          ))}
        </ListCard>
      )}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editing ? "Editar proveedor" : "Nuevo proveedor"}</SheetTitle></SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <Field label="Nombre" {...register("nombre")} error={errors.nombre?.message} />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : editing ? "Guardar" : "Crear"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </SectionShell>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELADERAS / UBICACIONES
// ═══════════════════════════════════════════════════════════════════════════════

function HeladerasSection({ onMutate }: { onMutate: () => void }) {
  const { data, isLoading } = useConfig<Ubicacion[]>("ubicaciones")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Ubicacion | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<{ nombre: string }>({
    resolver: zodResolver(z.object({ nombre: z.string().min(1, "Requerido") })),
  })

  function abrirCrear() { setEditing(null); reset({ nombre: "" }); setSheetOpen(true) }
  function abrirEditar(u: Ubicacion) { setEditing(u); reset({ nombre: u.nombre }); setSheetOpen(true) }

  async function onSubmit({ nombre }: { nombre: string }) {
    try {
      if (editing) { await editarUbicacionAction(editing.id, { nombre }); toast.success("Heladera actualizada") }
      else { await crearUbicacionAction({ nombre }); toast.success("Heladera creada") }
      setSheetOpen(false); onMutate()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
  }

  async function toggle(u: Ubicacion) {
    setPending(u.id)
    try {
      if (u.activo) await desactivarUbicacionAction(u.id)
      else await reactivarUbicacionAction(u.id)
      toast.success(u.activo ? `"${u.nombre}" desactivada` : `"${u.nombre}" reactivada`)
      onMutate()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setPending(null) }
  }

  async function eliminar(u: Ubicacion) {
    setPending(u.id)
    try {
      await eliminarUbicacionAction(u.id)
      toast.success(`"${u.nombre}" eliminada`)
      onMutate()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setPending(null) }
  }

  return (
    <SectionShell
      title="Heladeras / Ubicaciones"
      action={<Button size="sm" onClick={abrirCrear} className="gap-1.5"><Plus className="size-3.5" /> Nueva</Button>}
    >
      <p className="text-xs text-muted-foreground -mt-2">Definen la lente "Por heladera" en Rentabilidad.</p>
      {isLoading ? <SkeletonList /> : (
        <ListCard>
          {data?.length === 0 && <EmptyRow label="Sin ubicaciones" />}
          {data?.map((u) => (
            <ActionRow
              key={u.id}
              primary={u.nombre}
              badge={<StatusBadge activo={u.activo} count={u.activo ? u._count.products : undefined} />}
              activo={u.activo}
              onEdit={() => abrirEditar(u)}
              onToggle={() => toggle(u)}
              onDelete={u._count.products === 0 ? () => eliminar(u) : undefined}
              isPending={pending === u.id}
            />
          ))}
        </ListCard>
      )}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editing ? "Editar ubicación" : "Nueva ubicación"}</SheetTitle></SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <Field label="Nombre" {...register("nombre")} error={errors.nombre?.message} />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : editing ? "Guardar" : "Crear"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </SectionShell>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIOS DE PAGO
// ═══════════════════════════════════════════════════════════════════════════════

const medioPagoSchema = z.object({
  nombre: z.string().min(1, "Requerido"),
  comisionPct: z.number().min(0, "Mínimo 0"),
  tipo: z.enum(["efectivo", "mercadopago", "digital"]),
  cajaId: z.string().nullable(),
  // Recargo por pago virtual — se configura acá, una sola vez por medio (no por caja)
  recargoTipo: z.enum(["PORCENTUAL", "FIJO"]),
  recargoVirtualPct: z.number().min(0),
  recargoVirtualFijoPesos: z.number().min(0),
  // Sub-selector solo de UI — decide cuál de los dos campos de abajo se manda al guardar
  mpDispositivo: z.enum(["qr", "posnet"]),
  mpExternalPosId: z.string(),
  mpTerminalId: z.string(),
})
type MedioPagoForm = z.infer<typeof medioPagoSchema>

const MEDIO_PAGO_DEFAULTS: MedioPagoForm = {
  nombre: "", comisionPct: 0, tipo: "digital", cajaId: null,
  recargoTipo: "PORCENTUAL", recargoVirtualPct: 0, recargoVirtualFijoPesos: 0,
  mpDispositivo: "qr", mpExternalPosId: "", mpTerminalId: "",
}

function MediosPagoSection({ onMutate }: { onMutate: () => void }) {
  const { data, isLoading } = useConfig<MedioPago[]>("medios-pago")
  const { data: cajas } = useConfig<CajaItem[]>("cajas")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<MedioPago | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<MedioPagoForm>({
    resolver: zodResolver(medioPagoSchema),
    defaultValues: MEDIO_PAGO_DEFAULTS,
  })
  const tipo = watch("tipo")
  const recargoTipo = watch("recargoTipo") ?? "PORCENTUAL"
  const mpDispositivo = watch("mpDispositivo") ?? "qr"

  function abrirCrear() { setEditing(null); reset(MEDIO_PAGO_DEFAULTS); setSheetOpen(true) }
  function abrirEditar(m: MedioPago) {
    setEditing(m)
    reset({
      nombre: m.nombre,
      comisionPct: m.comisionBp / 100,
      tipo: tipoFromMedio(m),
      cajaId: m.cajaId,
      recargoTipo: (m.recargoTipo as "PORCENTUAL" | "FIJO") ?? "PORCENTUAL",
      recargoVirtualPct: m.recargoVirtualBp / 100,
      recargoVirtualFijoPesos: m.recargoVirtualFijoCentavos / 100,
      mpDispositivo: m.mpTerminalId ? "posnet" : "qr",
      mpExternalPosId: m.mpExternalPosId ?? "",
      mpTerminalId: m.mpTerminalId ?? "",
    })
    setSheetOpen(true)
  }

  async function onSubmit(data: MedioPagoForm) {
    const flags = flagsFromTipo(data.tipo)
    const payload = {
      nombre: data.nombre,
      comisionBp: Math.round(data.comisionPct * 100),
      ...flags,
      cajaId: data.cajaId,
      recargoTipo: data.recargoTipo,
      recargoVirtualBp: Math.round(data.recargoVirtualPct * 100),
      recargoVirtualFijoCentavos: Math.round(data.recargoVirtualFijoPesos * 100),
      mpExternalPosId: data.mpDispositivo === "qr" ? (data.mpExternalPosId.trim() || null) : null,
      mpTerminalId: data.mpDispositivo === "posnet" ? (data.mpTerminalId.trim() || null) : null,
    }
    try {
      if (editing) {
        await editarMedioPagoAction(editing.id, payload)
        toast.success("Medio de pago actualizado")
      } else {
        await crearMedioPagoAction(payload)
        toast.success("Medio de pago creado")
      }
      setSheetOpen(false); onMutate()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
  }

  async function run(id: string, fn: () => Promise<unknown>, msg: string) {
    setPending(id)
    try { await fn(); toast.success(msg); onMutate() }
    catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setPending(null) }
  }

  const sorted = [...(data ?? [])].sort((a, b) => a.orden - b.orden)

  return (
    <SectionShell
      title="Medios de pago"
      action={<Button size="sm" onClick={abrirCrear} className="gap-1.5"><Plus className="size-3.5" /> Nuevo</Button>}
    >
      {isLoading ? <SkeletonList /> : (
        <ListCard>
          {sorted.length === 0 && <EmptyRow label="Sin medios de pago" />}
          {sorted.map((m, idx) => (
            <div
              key={m.id}
              className={cn("px-4 py-3 flex items-center gap-3", !m.activo && "opacity-60")}
            >
              {/* Orden arriba/abajo */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  disabled={idx === 0 || !!pending}
                  onClick={() => run(m.id, () => moverOrdenMedioPagoAction(m.id, "arriba"), "Orden actualizado")}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === sorted.length - 1 || !!pending}
                  onClick={() => run(m.id, () => moverOrdenMedioPagoAction(m.id, "abajo"), "Orden actualizado")}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronDown className="size-3.5" />
                </button>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{m.nombre}</p>
                  {m.esDefault && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-k-gain-muted text-k-gain font-medium">
                      Default
                    </span>
                  )}
                  {!m.activo && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                      Inactivo
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {TIPO_LABELS[tipoFromMedio(m)]}
                  {m.comisionBp > 0 && ` · Comisión: ${(m.comisionBp / 100).toFixed(2)}%`}
                  {(m.recargoVirtualBp > 0 || m.recargoVirtualFijoCentavos > 0) && (
                    ` · Recargo: ${m.recargoTipo === "PORCENTUAL" ? `${(m.recargoVirtualBp / 100).toFixed(1)}%` : `$${(m.recargoVirtualFijoCentavos / 100).toFixed(2)}`}`
                  )}
                  {m.cajaId && ` · Caja: ${cajas?.find((c) => c.id === m.cajaId)?.nombre ?? "—"}`}
                </p>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-1 shrink-0">
                {pending === m.id && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                {pending !== m.id && (
                  <>
                    {!m.esDefault && m.activo && (
                      <Button
                        variant="ghost" size="icon-sm"
                        onClick={() => run(m.id, () => setDefaultMedioPagoAction(m.id), `"${m.nombre}" es el default`)}
                        title="Marcar como default"
                      >
                        <Star className="size-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon-sm" onClick={() => abrirEditar(m)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon-sm"
                      onClick={() => run(m.id,
                        m.activo ? () => desactivarMedioPagoAction(m.id) : () => reactivarMedioPagoAction(m.id),
                        m.activo ? `"${m.nombre}" desactivado` : `"${m.nombre}" reactivado`
                      )}
                      title={m.activo ? "Desactivar" : "Reactivar"}
                    >
                      {m.activo ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </ListCard>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editing ? "Editar medio de pago" : "Nuevo medio de pago"}</SheetTitle></SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <Field label="Nombre" {...register("nombre")} error={errors.nombre?.message} />
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={watch("tipo")} onValueChange={(v) => v && setValue("tipo", v as TipoPago)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="mercadopago">MercadoPago</SelectItem>
                  <SelectItem value="digital">Transferencia / QR</SelectItem>
                </SelectContent>
              </Select>
              {watch("tipo") === "mercadopago" && (
                <p className="text-xs text-muted-foreground">La comisión de MercadoPago se aplica al liquidar, no al precio de venta.</p>
              )}
            </div>
            {watch("tipo") === "mercadopago" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Dispositivo</Label>
                  <Select value={mpDispositivo} onValueChange={(v) => v && setValue("mpDispositivo", v as "qr" | "posnet")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="qr">QR</SelectItem>
                      <SelectItem value="posnet">Posnet (Point)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {mpDispositivo === "qr" ? (
                  <div className="space-y-1.5">
                    <Field
                      label="External POS ID (MercadoPago)"
                      placeholder="ej. SUC0101POS"
                      {...register("mpExternalPosId")}
                      error={errors.mpExternalPosId?.message}
                    />
                    <p className="text-xs text-muted-foreground">
                      ID de la caja/QR físico en MercadoPago (Tu negocio → Sucursales y cajas). Necesario para
                      que el POS mande el monto real al QR al cobrar.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Field
                      label="Terminal ID (MercadoPago)"
                      placeholder="ej. NEWLAND_N950__N950NCC503383252"
                      {...register("mpTerminalId")}
                      error={errors.mpTerminalId?.message}
                    />
                    <p className="text-xs text-muted-foreground">
                      ID de la terminal Point (MercadoPago → Terminales). Necesario para que el POS mande
                      el monto real al posnet al cobrar.
                    </p>
                  </div>
                )}
              </div>
            )}
            <Field label="Comisión (%)" type="number" step="0.01" min="0" {...register("comisionPct", { valueAsNumber: true })} error={errors.comisionPct?.message} />
            <div className="space-y-1.5">
              <Label>Caja de destino (opcional)</Label>
              <Select
                value={watch("cajaId") ?? "__categoria__"}
                onValueChange={(v) => setValue("cajaId", v === "__categoria__" ? null : (v ?? null))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__categoria__">Según categoría del producto (default)</SelectItem>
                  {cajas?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Si elegís una caja, las ventas pagadas con este medio se atribuyen enteras a esa caja
                (por ejemplo, una caja de MercadoPago separada del efectivo).
              </p>
            </div>

            {tipo !== "efectivo" && (
              <div className="space-y-2 rounded-xl border border-border/60 p-3">
                <div className="flex items-center justify-between">
                  <Label>Recargo por pago con este medio</Label>
                  <Select value={recargoTipo} onValueChange={(v) => v && setValue("recargoTipo", v as "PORCENTUAL" | "FIJO")}>
                    <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PORCENTUAL">%</SelectItem>
                      <SelectItem value="FIJO">$ fijo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {recargoTipo === "PORCENTUAL" ? (
                  <Field
                    label="Recargo (%)"
                    type="number" step="0.1" min="0"
                    {...register("recargoVirtualPct", { valueAsNumber: true })}
                    placeholder="0"
                  />
                ) : (
                  <Field
                    label="Recargo fijo ($)"
                    type="number" step="0.01" min="0"
                    {...register("recargoVirtualFijoPesos", { valueAsNumber: true })}
                    placeholder="0"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Se suma automáticamente al total cuando se elige este medio en el POS. 0 = sin recargo.
                </p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : editing ? "Guardar cambios" : "Crear"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </SectionShell>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// GASTOS FIJOS
// ═══════════════════════════════════════════════════════════════════════════════

function GastosFijosSection({ onMutate }: { onMutate: () => void }) {
  const { data, isLoading } = useConfig<GastoFijo[]>("gastos-fijos")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<"crear" | "editar" | "historial">("crear")
  const [selected, setSelected] = useState<GastoFijo | null>(null)
  const [editingMontoId, setEditingMontoId] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  const now = new Date()
  const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const activosData = data?.filter((g) => g.activo) ?? []
  const inactivosData = data?.filter((g) => !g.activo) ?? []
  const totalMensual = activosData.reduce((sum, g) => {
    const m = g.montos.find((m) => m.mesAnio === mesActual) ?? g.montos[0]
    return sum + (m?.montoCentavos ?? 0)
  }, 0)

  async function run(id: string, fn: () => Promise<unknown>, msg: string) {
    setPending(id)
    try { await fn(); toast.success(msg); onMutate() }
    catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setPending(null) }
  }

  return (
    <SectionShell
      title="Gastos fijos"
      action={<Button size="sm" onClick={() => { setSheetMode("crear"); setSelected(null); setSheetOpen(true) }} className="gap-1.5"><Plus className="size-3.5" /> Nuevo</Button>}
    >
      {/* Total mensual */}
      {!isLoading && activosData.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Total mensual activo</p>
          <p className="text-lg font-semibold tabular-nums">{formatearARS(totalMensual)}</p>
        </div>
      )}

      {isLoading ? <SkeletonList /> : (
        <div className="space-y-2">
          <ListCard>
            {activosData.length === 0 && <EmptyRow label="Sin gastos fijos activos" />}
            {activosData.map((g) => {
              const montoActual = g.montos.find((m) => m.mesAnio === mesActual) ?? g.montos[0]
              return (
                <div key={g.id}>
                  <div className={cn("px-4 py-3 flex items-center gap-3")}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{g.nombre}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {montoActual ? formatearARS(montoActual.montoCentavos) : "Sin monto este mes"}
                        {montoActual && montoActual.mesAnio !== mesActual && (
                          <span className="text-muted-foreground/60"> (mes anterior)</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {pending === g.id && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                      {pending !== g.id && (
                        <>
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditingMontoId(editingMontoId === g.id ? null : g.id)} title="Editar monto de este mes">
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => { setSelected(g); setSheetMode("editar"); setSheetOpen(true) }} title="Renombrar">
                            <Tag className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => { setSelected(g); setSheetMode("historial"); setSheetOpen(true) }} title="Historial">
                            <Receipt className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => run(g.id, () => desactivarGastoFijoAction(g.id), `"${g.nombre}" desactivado`)} title="Desactivar">
                            <EyeOff className="size-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Inline monto edit */}
                  {editingMontoId === g.id && (
                    <MontoInlineEdit
                      defaultValue={montoActual ? montoActual.montoCentavos / 100 : 0}
                      onSave={async (v) => {
                        await run(g.id, () => actualizarMontoGastoFijoAction(g.id, Math.round(v * 100)), "Monto actualizado")
                        setEditingMontoId(null)
                      }}
                      onCancel={() => setEditingMontoId(null)}
                    />
                  )}
                </div>
              )
            })}
          </ListCard>

          {inactivosData.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground px-1 pb-1">Inactivos</p>
              <ListCard>
                {inactivosData.map((g) => (
                  <div key={g.id} className="px-4 py-3 flex items-center gap-3 opacity-60">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{g.nombre}</p>
                      <p className="text-xs text-muted-foreground">Desactivado</p>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => run(g.id, () => reactivarGastoFijoAction(g.id), `"${g.nombre}" reactivado`)} title="Reactivar">
                      <Eye className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </ListCard>
            </div>
          )}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          {sheetMode === "crear" && (
            <GastoFijoCrearForm
              mesActual={mesActual}
              onSuccess={() => { setSheetOpen(false); onMutate() }}
            />
          )}
          {sheetMode === "editar" && selected && (
            <GastoFijoEditarForm
              gasto={selected}
              onSuccess={() => { setSheetOpen(false); onMutate() }}
            />
          )}
          {sheetMode === "historial" && selected && (
            <GastoFijoHistorial gasto={selected} mesActual={mesActual} />
          )}
        </SheetContent>
      </Sheet>
    </SectionShell>
  )
}

function MontoInlineEdit({ defaultValue, onSave, onCancel }: { defaultValue: number; onSave: (v: number) => Promise<void>; onCancel: () => void }) {
  const { register, handleSubmit } = useForm({ defaultValues: { monto: defaultValue } })
  return (
    <form onSubmit={handleSubmit((d) => onSave(d.monto))} className="px-4 pb-3 flex gap-2">
      <Input type="number" step="0.01" min="0" {...register("monto", { valueAsNumber: true })} className="rounded-lg tabular-nums h-8 text-sm" autoFocus />
      <Button type="submit" size="sm">Guardar</Button>
      <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
    </form>
  )
}

function GastoFijoCrearForm({ mesActual, onSuccess }: { mesActual: string; onSuccess: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ nombre: string; monto: number }>({
    resolver: zodResolver(z.object({ nombre: z.string().min(1), monto: z.number().positive() })),
  })
  async function onSubmit(d: { nombre: string; monto: number }) {
    try {
      await crearGastoFijoAction({ nombre: d.nombre, montoMensualCentavos: Math.round(d.monto * 100), mesAnio: mesActual })
      toast.success("Gasto fijo creado"); onSuccess()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
  }
  return (
    <>
      <SheetHeader><SheetTitle>Nuevo gasto fijo</SheetTitle></SheetHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <Field label="Nombre" {...register("nombre")} error={errors.nombre?.message} />
        <Field label="Monto mensual ($)" type="number" step="0.01" min="0" {...register("monto", { valueAsNumber: true })} error={errors.monto?.message} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Crear"}
        </Button>
      </form>
    </>
  )
}

function GastoFijoEditarForm({ gasto, onSuccess }: { gasto: GastoFijo; onSuccess: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ nombre: string }>({
    resolver: zodResolver(z.object({ nombre: z.string().min(1) })),
    defaultValues: { nombre: gasto.nombre },
  })
  async function onSubmit(d: { nombre: string }) {
    try {
      await editarGastoFijoAction(gasto.id, { nombre: d.nombre })
      toast.success("Gasto fijo actualizado"); onSuccess()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
  }
  return (
    <>
      <SheetHeader><SheetTitle>Renombrar gasto fijo</SheetTitle></SheetHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <Field label="Nombre" {...register("nombre")} error={errors.nombre?.message} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
        </Button>
      </form>
    </>
  )
}

function GastoFijoHistorial({ gasto, mesActual }: { gasto: GastoFijo; mesActual: string }) {
  return (
    <>
      <SheetHeader><SheetTitle>Historial — {gasto.nombre}</SheetTitle></SheetHeader>
      <div className="mt-6 divide-y divide-border/40">
        {gasto.montos.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Sin historial</p>}
        {gasto.montos.map((m) => (
          <div key={m.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium tabular-nums">{m.mesAnio}</p>
              {m.mesAnio === mesActual && (
                <p className="text-xs text-muted-foreground">Mes actual</p>
              )}
            </div>
            <p className="text-sm font-semibold tabular-nums">{formatearARS(m.montoCentavos)}</p>
          </div>
        ))}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// OPERACIÓN (escáner — más ajustes en Fase 6)
// ═══════════════════════════════════════════════════════════════════════════════

const SCANNER_PREF_KEY = "pyme_scanner_pref"
type ScannerPref = "sumar-stock" | "abrir-producto"

function OperacionSection() {
  const [pref, setPref] = useState<ScannerPref>(() => {
    if (typeof window === "undefined") return "sumar-stock"
    return (localStorage.getItem(SCANNER_PREF_KEY) as ScannerPref) ?? "sumar-stock"
  })

  function cambiar(v: ScannerPref) {
    setPref(v)
    localStorage.setItem(SCANNER_PREF_KEY, v)
    toast.success("Preferencia guardada")
  }

  const opts: { value: ScannerPref; label: string; desc: string }[] = [
    { value: "sumar-stock", label: "Sumar stock (+1)", desc: "Entrada automática al escanear un producto existente en Productos" },
    { value: "abrir-producto", label: "Abrir producto", desc: "Navega al detalle del producto escaneado" },
  ]

  const [redisparandoOnboarding, setRedisparandoOnboarding] = useState(false)

  async function handleRedispararOnboarding() {
    setRedisparandoOnboarding(true)
    try {
      await resetearOnboardingAction()
    } catch {
      setRedisparandoOnboarding(false)
      toast.error("No se pudo re-disparar el onboarding")
    }
  }

  return (
    <SectionShell title="Operación">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">Asistente de configuración inicial</p>
          <ListCard>
            <div className="px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Re-ejecutar onboarding</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Volvé al wizard de configuración sin borrar ningún dato ya cargado.
                </p>
              </div>
              <Button
                variant="outline" size="sm"
                onClick={handleRedispararOnboarding}
                disabled={redisparandoOnboarding}
              >
                {redisparandoOnboarding ? "..." : "Iniciar"}
              </Button>
            </div>
          </ListCard>
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Escáner — al leer un código en Productos</p>
          <ListCard>
            {opts.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => cambiar(opt.value)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
              >
                <span className={cn(
                  "mt-0.5 size-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
                  pref === opt.value ? "border-foreground bg-foreground" : "border-border"
                )}>
                  {pref === opt.value && <span className="size-1.5 rounded-full bg-background" />}
                </span>
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </div>
              </button>
            ))}
          </ListCard>
        </div>
      </div>
    </SectionShell>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAJAS
// ═══════════════════════════════════════════════════════════════════════════════

const cajaSchema = z.object({
  nombre: z.string().min(1, "Requerido"),
})
type CajaFormData = z.infer<typeof cajaSchema>

function CajasSection({ onMutate }: { onMutate: () => void }) {
  const { data, isLoading } = useConfig<CajaItem[]>("cajas")
  const [sheetMode, setSheetMode] = useState<"crear" | "editar" | "categorias">("crear")
  const [selected, setSelected] = useState<CajaItem | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pending, setPending] = useState<string | null>(null)

  async function toggle(c: CajaItem) {
    setPending(c.id)
    try {
      if (c.activo) {
        await desactivarCajaAction(c.id)
        toast.success(`"${c.nombre}" desactivada`)
      } else {
        await reactivarCajaAction(c.id)
        toast.success(`"${c.nombre}" reactivada`)
      }
      onMutate()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setPending(null) }
  }

  function abrirCrear() {
    setSelected(null); setSheetMode("crear"); setSheetOpen(true)
  }
  function abrirEditar(c: CajaItem) {
    setSelected(c); setSheetMode("editar"); setSheetOpen(true)
  }
  function abrirCategorias(c: CajaItem) {
    setSelected(c); setSheetMode("categorias"); setSheetOpen(true)
  }

  return (
    <SectionShell
      title="Cajas"
      action={
        <Button size="sm" onClick={abrirCrear} className="gap-1.5">
          <Plus className="size-3.5" /> Nueva
        </Button>
      }
    >
      {isLoading ? <SkeletonList /> : (
        <ListCard>
          {data?.length === 0 && <EmptyRow label="Sin cajas" />}
          {data?.map((c) => {
            const sesionAbierta = c.sesiones[0]
            return (
              <div key={c.id} className={cn("px-4 py-3 flex items-center gap-3", !c.activo && "opacity-60")}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{c.nombre}</p>
                    {c.esPrincipal && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-foreground text-background font-medium">Principal</span>
                    )}
                    {sesionAbierta ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-green-500/15 text-green-700 dark:text-green-400 font-medium">Abierta</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">Cerrada</span>
                    )}
                    {!c.activo && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">Inactiva</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c._count.categories} categoría(s)
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {pending === c.id && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                  {pending !== c.id && (
                    <>
                      <Button variant="ghost" size="icon-sm" onClick={() => abrirEditar(c)} title="Editar">
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => abrirCategorias(c)} title="Asignar categorías">
                        <Tag className="size-3.5" />
                      </Button>
                      {!c.esPrincipal && (
                        <Button variant="ghost" size="icon-sm" onClick={() => toggle(c)} title={c.activo ? "Desactivar" : "Reactivar"}>
                          {c.activo ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </ListCard>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          {sheetMode === "crear" && (
            <CajaForm
              onSuccess={() => { setSheetOpen(false); onMutate() }}
            />
          )}
          {sheetMode === "editar" && selected && (
            <CajaForm
              caja={selected}
              onSuccess={() => { setSheetOpen(false); onMutate() }}
            />
          )}
          {sheetMode === "categorias" && selected && (
            <CajaCategoriasForm
              caja={selected}
              todasLasCategorias={[]} // se carga internamente
              onSuccess={() => { setSheetOpen(false); onMutate() }}
            />
          )}
        </SheetContent>
      </Sheet>
    </SectionShell>
  )
}

function CajaForm({ caja, onSuccess }: { caja?: CajaItem; onSuccess: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CajaFormData>({
    resolver: zodResolver(cajaSchema),
    defaultValues: {
      nombre: caja?.nombre ?? "",
    },
  })

  async function onSubmit(data: CajaFormData) {
    try {
      if (caja) {
        await editarCajaAction(caja.id, data)
        toast.success("Caja actualizada")
      } else {
        await crearCajaAction(data)
        toast.success("Caja creada")
      }
      onSuccess()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
  }

  return (
    <>
      <SheetHeader><SheetTitle>{caja ? "Editar caja" : "Nueva caja"}</SheetTitle></SheetHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <Field label="Nombre" {...register("nombre")} error={errors.nombre?.message} />

        <p className="text-xs text-muted-foreground">
          El recargo por pago virtual se configura en Medios de pago, no acá.
        </p>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : caja ? "Guardar" : "Crear"}
        </Button>
      </form>
    </>
  )
}

function CajaCategoriasForm({
  caja,
  onSuccess,
}: {
  caja: CajaItem
  todasLasCategorias: { id: string; nombre: string }[]
  onSuccess: () => void
}) {
  const { data: todasCajas } = useConfig<CajaItem[]>("cajas")
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(
    new Set(caja.categories.map((c) => c.id))
  )
  const [saving, setSaving] = useState(false)

  // Todas las categorías de todas las cajas (incluyendo sin asignar)
  const todasCategoriasMap = new Map<string, { id: string; nombre: string; cajaId: string | null; cajaNombre: string | null }>()
  todasCajas?.forEach((c) => {
    c.categories.forEach((cat) => {
      todasCategoriasMap.set(cat.id, { ...cat, cajaId: c.id, cajaNombre: c.nombre })
    })
  })
  // También incluir las ya asignadas a esta caja
  caja.categories.forEach((cat) => {
    if (!todasCategoriasMap.has(cat.id)) {
      todasCategoriasMap.set(cat.id, { ...cat, cajaId: caja.id, cajaNombre: caja.nombre })
    }
  })

  // De /api/config/categorias obtenemos TODAS incluyendo las sin asignar
  const { data: categoriasAll } = useConfig<{ id: string; nombre: string; activo: boolean; cajaId: string | null }[]>("categorias")

  function toggle(id: string) {
    setSeleccionadas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function guardar() {
    setSaving(true)
    try {
      await asignarCategoriasCajaAction(caja.id, [...seleccionadas])
      toast.success("Categorías asignadas")
      onSuccess()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Categorías — {caja.nombre}</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4">
        <p className="text-xs text-muted-foreground">
          Marcá las categorías que cobra esta caja. Las sin marcar usan la caja principal.
        </p>
        <div className="divide-y divide-border/40 rounded-xl border border-border/60 overflow-hidden">
          {categoriasAll?.map((cat) => {
            const checked = seleccionadas.has(cat.id)
            const otraCaja = todasCajas?.find((c) => c.id !== caja.id && c.categories.some((cc) => cc.id === cat.id))
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggle(cat.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/20",
                  !cat.activo && "opacity-50"
                )}
              >
                <span className={cn(
                  "size-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors",
                  checked ? "bg-foreground border-foreground" : "border-border"
                )}>
                  {checked && <Check className="size-2.5 text-background" />}
                </span>
                <span className="flex-1">{cat.nombre}</span>
                {otraCaja && (
                  <span className="text-[10px] text-muted-foreground/60 shrink-0">→ {otraCaja.nombre}</span>
                )}
                {!cat.activo && (
                  <span className="text-[10px] text-muted-foreground shrink-0">Inactiva</span>
                )}
              </button>
            )
          })}
        </div>
        <Button className="w-full" onClick={guardar} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Guardar asignación"}
        </Button>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEGOCIO
// ═══════════════════════════════════════════════════════════════════════════════

const negocioSchema = z.object({
  nombre: z.string().min(1, "Requerido"),
  cuit: z.string().optional(),
  condicionIva: z.enum(["RESPONSABLE_INSCRIPTO", "MONOTRIBUTO", "EXENTO", "CONSUMIDOR_FINAL"]).optional(),
  puntoDeVenta: z.number().int().positive().optional(),
  stockMinimoDefault: z.number().int().min(0),
})
type NegocioFormData = z.infer<typeof negocioSchema>

const CONDICION_IVA_OPTS = [
  { value: "RESPONSABLE_INSCRIPTO", label: "Responsable Inscripto" },
  { value: "MONOTRIBUTO",           label: "Monotributista" },
  { value: "EXENTO",                label: "Exento" },
  { value: "CONSUMIDOR_FINAL",      label: "Consumidor Final" },
]

function NegocioSection({ onMutate }: { onMutate: () => void }) {
  const { data, isLoading } = useConfig<Organizacion>("negocio")
  if (isLoading) return <SkeletonList />
  if (!data) return <EmptyRow label="No se pudo cargar" />
  return <NegocioForm data={data} onMutate={onMutate} />
}

function NegocioForm({ data, onMutate }: { data: Organizacion; onMutate: () => void }) {
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<NegocioFormData>({
    resolver: zodResolver(negocioSchema),
    defaultValues: {
      nombre: data.nombre,
      cuit: data.cuit ?? "",
      condicionIva: (data.condicionIva as NegocioFormData["condicionIva"]) ?? undefined,
      puntoDeVenta: data.puntoDeVenta ?? undefined,
      stockMinimoDefault: data.stockMinimoDefault,
    },
  })

  async function onSubmit(formData: NegocioFormData) {
    try {
      await actualizarNegocioAction({
        nombre: formData.nombre,
        cuit: formData.cuit || null,
        condicionIva: formData.condicionIva || null,
        puntoDeVenta: formData.puntoDeVenta || null,
        stockMinimoDefault: formData.stockMinimoDefault,
      })
      toast.success("Datos del negocio actualizados")
      onMutate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error")
    }
  }

  return (
    <SectionShell title="Negocio">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
        <Field label="Nombre del negocio" {...register("nombre")} error={errors.nombre?.message} />
        <Field label="CUIT" placeholder="20-12345678-9" {...register("cuit")} />
        <div className="space-y-1.5">
          <Label>Condición IVA</Label>
          <Select
            defaultValue={data.condicionIva ?? undefined}
            onValueChange={(v) => setValue("condicionIva", v as NegocioFormData["condicionIva"])}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              {CONDICION_IVA_OPTS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Field
          label="Punto de venta"
          type="number" min="1" max="9999" placeholder="1"
          {...register("puntoDeVenta", { valueAsNumber: true })}
          error={errors.puntoDeVenta?.message}
        />
        <Field
          label="Stock mínimo default (unidades)"
          type="number" min="0"
          {...register("stockMinimoDefault", { valueAsNumber: true })}
          error={errors.stockMinimoDefault?.message}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin mr-2" />}
          Guardar cambios
        </Button>
      </form>
    </SectionShell>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// USUARIOS
// ═══════════════════════════════════════════════════════════════════════════════

const crearUsuarioSchema = z.object({
  nombre: z.string().min(1, "Requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  role: z.enum(["ADMIN", "VENDEDOR"]),
})
type CrearUsuarioForm = z.infer<typeof crearUsuarioSchema>

function UsuariosSection({ onMutate }: { onMutate: () => void }) {
  const { data: session } = useSession()
  const { data, isLoading } = useConfig<Usuario[]>("usuarios")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pending, setPending] = useState<string | null>(null)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<CrearUsuarioForm>({
    resolver: zodResolver(crearUsuarioSchema),
    defaultValues: { role: "VENDEDOR" },
  })

  async function onSubmit(formData: CrearUsuarioForm) {
    try {
      await crearUsuarioAction(formData)
      toast.success("Usuario creado")
      setSheetOpen(false)
      reset()
      onMutate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error")
    }
  }

  async function toggleActivo(u: Usuario) {
    setPending(u.id)
    try {
      if (u.activo) {
        await desactivarUsuarioAction(u.id)
        toast.success(`"${u.nombre}" desactivado`)
      } else {
        await reactivarUsuarioAction(u.id)
        toast.success(`"${u.nombre}" reactivado`)
      }
      onMutate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error")
    } finally {
      setPending(null)
    }
  }

  async function toggleRol(u: Usuario) {
    if (u.id === session?.user?.id) {
      toast.error("No podés cambiar tu propio rol")
      return
    }
    setPending(u.id)
    try {
      const nuevoRol = u.role === "ADMIN" ? "VENDEDOR" : "ADMIN"
      await cambiarRolUsuarioAction(u.id, nuevoRol)
      toast.success(`Rol de "${u.nombre}" cambiado a ${nuevoRol}`)
      onMutate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error")
    } finally {
      setPending(null)
    }
  }

  return (
    <SectionShell
      title="Usuarios"
      action={
        <Button size="sm" onClick={() => { reset({ role: "VENDEDOR" }); setSheetOpen(true) }} className="gap-1.5">
          <Plus className="size-3.5" /> Nuevo
        </Button>
      }
    >
      {isLoading ? <SkeletonList /> : (
        <ListCard>
          {data?.length === 0 && <EmptyRow label="Sin usuarios" />}
          {data?.map((u) => (
            <div key={u.id} className={cn("px-4 py-3 flex items-center gap-3", !u.activo && "opacity-60")}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{u.nombre}</p>
                  {u.id === session?.user?.id && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-foreground/8 text-muted-foreground font-medium">Vos</span>
                  )}
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-md font-medium",
                    u.role === "ADMIN" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                  )}>
                    {u.role === "ADMIN" ? "Admin" : "Vendedor"}
                  </span>
                  {!u.activo && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">Inactivo</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {pending === u.id && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                {pending !== u.id && (
                  <>
                    <Button
                      variant="ghost" size="icon-sm"
                      onClick={() => toggleRol(u)}
                      title={u.role === "ADMIN" ? "Cambiar a Vendedor" : "Cambiar a Admin"}
                      disabled={u.id === session?.user?.id}
                    >
                      <Shield className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon-sm"
                      onClick={() => toggleActivo(u)}
                      title={u.activo ? "Desactivar" : "Reactivar"}
                      disabled={u.id === session?.user?.id}
                    >
                      {u.activo ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </ListCard>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>Nuevo usuario</SheetTitle></SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <Field label="Nombre" {...register("nombre")} error={errors.nombre?.message} />
            <Field label="Email" type="email" {...register("email")} error={errors.email?.message} />
            <Field label="Contraseña" type="password" {...register("password")} error={errors.password?.message} />
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select defaultValue="VENDEDOR" onValueChange={(v) => setValue("role", v as "ADMIN" | "VENDEDOR")}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VENDEDOR">Vendedor</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Crear usuario"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </SectionShell>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATOS
// ═══════════════════════════════════════════════════════════════════════════════

function DatosSection() {
  return (
    <SectionShell title="Datos">
      <div className="space-y-6 max-w-md">
        <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
          <div>
            <p className="text-sm font-medium">Respaldo de configuración</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Descargá un archivo JSON con toda tu configuración: categorías, proveedores, medios de pago, gastos fijos y productos activos.
            </p>
          </div>
          <a href="/api/config/backup" download>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="size-3.5" /> Descargar backup JSON
            </Button>
          </a>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
          <div>
            <p className="text-sm font-medium">Exportar datos</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Exportá tus datos en formato CSV para usar en Excel u otras herramientas.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <a href="/api/reportes/exportar/stock" download>
              <Button variant="outline" size="sm" className="gap-1.5 w-full">
                <Download className="size-3.5" /> Exportar stock (CSV)
              </Button>
            </a>
            <a href="/api/reportes/exportar/ventas" download>
              <Button variant="outline" size="sm" className="gap-1.5 w-full">
                <Download className="size-3.5" /> Exportar ventas (CSV)
              </Button>
            </a>
          </div>
        </div>
      </div>
    </SectionShell>
  )
}

// ─── Micro-componentes ────────────────────────────────────────────────────────

function SkeletonList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-14 rounded-2xl" />
      ))}
    </div>
  )
}

function EmptyRow({ label }: { label: string }) {
  return <div className="px-4 py-4 text-sm text-muted-foreground">{label}</div>
}
