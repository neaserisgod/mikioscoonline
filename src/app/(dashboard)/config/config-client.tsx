"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus, Pencil, Trash2, EyeOff, Eye, ChevronUp, ChevronDown,
  Star, Tag, Truck, Archive, CreditCard, Receipt,
  Settings2, Check, Loader2,
  Building2, Users, Database, Shield, Download, Wallet, KeyRound,
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
import { Checkbox } from "@/components/ui/checkbox"
import { useSession } from "next-auth/react"
import { Skeleton } from "@/components/ui/skeleton"
import { formatearARS } from "@/domain/dinero"
import { cn } from "@/lib/utils"
import { Field, StatusBadge, SectionShell, ListCard, ActionRow } from "@/components/config/list-primitives"
import {
  crearCategoriaAction, editarCategoriaAction,
  desactivarCategoriaAction, reactivarCategoriaAction, eliminarCategoriaAction,
  crearProveedorAction, editarProveedorAction,
  desactivarProveedorAction, reactivarProveedorAction, eliminarProveedorAction,
  registrarCompraCuentaCorrienteAction, registrarPagoCuentaCorrienteAction, actualizarPisoReposicionAction,
  crearUbicacionAction, editarUbicacionAction,
  desactivarUbicacionAction, reactivarUbicacionAction, eliminarUbicacionAction,
  crearMedioPagoAction, editarMedioPagoAction,
  desactivarMedioPagoAction, reactivarMedioPagoAction,
  setDefaultMedioPagoAction, moverOrdenMedioPagoAction,
  crearGastoFijoAction, editarGastoFijoAction,
  actualizarMontoGastoFijoAction, desactivarGastoFijoAction, reactivarGastoFijoAction, pagarGastoFijoAction,
  actualizarNegocioAction,
  crearUsuarioAction, desactivarUsuarioAction, reactivarUsuarioAction, cambiarRolUsuarioAction,
  crearPerfilPinAction, resetearPinUsuarioAction,
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
  | "cajas" | "movimientos"
  | "operacion" | "usuarios" | "datos"

interface Categoria {
  id: string; nombre: string; markupDefaultBp: number; activo: boolean
  markupDefaultTipo: string; markupDefaultFijoCentavos: number
  _count: { products: number }
}
interface Proveedor {
  id: string; nombre: string; activo: boolean
  saldoCuentaCorrienteCentavos: number
  pisoReposicionCentavos: number
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
  facturarAutomaticamente: boolean
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
  puntoDeVenta: number | null; facturacionModoProduccion: boolean; imprimirTicketPosnet: boolean
  stockMinimoDefault: number; horariosArqueo: string | null
}
interface Usuario {
  id: string; nombre: string; email: string | null; role: "ADMIN" | "VENDEDOR"
  activo: boolean; createdAt: string; tienePin: boolean
}
interface GastoFijo {
  id: string; nombre: string; activo: boolean
  montos: { id: string; mesAnio: string; montoCentavos: number }[]
  pagadoMesActualCentavos: number
}

// ─── Navegación ───────────────────────────────────────────────────────────────

const SECCIONES: { id: SeccionId; label: string; icon: React.ElementType; group?: string }[] = [
  { id: "negocio",     label: "Negocio",        icon: Building2,  group: "General" },
  { id: "cajas",       label: "Cajas",          icon: Wallet,     group: "General" },
  { id: "movimientos", label: "Movimientos",    icon: Receipt,    group: "General" },
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

// ─── Página principal ─────────────────────────────────────────────────────────

export function ConfigClient() {
  // React Compiler memoiza mal el bloque de AnimatePresence + secciones
  // condicionales: el nav cambiaba de estado pero el panel quedaba pegado
  // en la sección anterior (o en blanco). Sin esto, cambiar de sección acá
  // no actualiza el contenido.
  "use no memo"
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
              {seccion === "movimientos" && <MovimientosSection />}
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
  const [cuentaProveedor, setCuentaProveedor] = useState<Proveedor | null>(null)
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
            <div key={p.id} className={cn("px-4 py-3 flex items-center gap-3", !p.activo && "opacity-60")}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{p.nombre}</p>
                  <StatusBadge activo={p.activo} count={p.activo ? p._count.products : undefined} />
                  {p.saldoCuentaCorrienteCentavos > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-k-loss/10 text-k-loss font-medium">
                      Debe {formatearARS(p.saldoCuentaCorrienteCentavos)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {pending === p.id && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                {pending !== p.id && (
                  <>
                    <Button variant="ghost" size="icon-sm" onClick={() => setCuentaProveedor(p)} title="Cuenta corriente">
                      <Wallet className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => abrirEditar(p)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => toggle(p)} title={p.activo ? "Desactivar" : "Reactivar"}>
                      {p.activo ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </Button>
                    {p._count.products === 0 && (
                      <Button variant="ghost" size="icon-sm" onClick={() => eliminar(p)} title="Eliminar" className="text-k-loss hover:text-k-loss">
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
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
      <Sheet open={!!cuentaProveedor} onOpenChange={(v) => !v && setCuentaProveedor(null)}>
        <SheetContent>
          {cuentaProveedor && (
            <CuentaCorrienteForm
              proveedor={cuentaProveedor}
              onSuccess={() => { setCuentaProveedor(null); onMutate() }}
            />
          )}
        </SheetContent>
      </Sheet>
    </SectionShell>
  )
}

interface ResumenProveedorStock {
  id: string
  valorCostoCentavos: number
  valorVentaCentavos: number
}
interface FilaRentabilidadProveedor {
  id: string
  ventasCentavos: number
}

function mesActualRango() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const ultimoDia = new Date(y, d.getMonth() + 1, 0).getDate()
  return { desde: `${y}-${m}-01`, hasta: `${y}-${m}-${String(ultimoDia).padStart(2, "0")}` }
}

function CuentaCorrienteForm({ proveedor, onSuccess }: { proveedor: Proveedor; onSuccess: () => void }) {
  const { data: cajas } = useConfig<CajaItem[]>("cajas")
  const [modo, setModo] = useState<"compra" | "pago">("pago")
  const [monto, setMonto] = useState("")
  const [cajaId, setCajaId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editandoPiso, setEditandoPiso] = useState(false)

  const cajasActivas = cajas?.filter((c) => c.activo) ?? []

  // Costo/precio de venta del stock actual de este proveedor + lo que
  // realmente facturó este mes — sin calcular ganancia, el dueño prefiere
  // ver los números crudos y sacar la cuenta él mismo.
  const { data: stockProveedores } = useQuery<ResumenProveedorStock[]>({
    queryKey: ["config-resumen-proveedores-stock"],
    queryFn: () => fetch("/api/productos/resumen-proveedores").then((r) => r.json()),
    staleTime: 60_000,
  })
  const { desde, hasta } = mesActualRango()
  const { data: ventasProveedores } = useQuery<FilaRentabilidadProveedor[]>({
    queryKey: ["config-rentabilidad-proveedor-mes", desde, hasta],
    queryFn: () => fetch(`/api/rentabilidad?por=proveedor&desde=${desde}&hasta=${hasta}`).then((r) => r.json()),
    staleTime: 60_000,
  })
  const stockDeEste = stockProveedores?.find((p) => p.id === proveedor.id)
  const ventasDeEste = ventasProveedores?.find((p) => p.id === proveedor.id)

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
      onSuccess()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setIsSubmitting(false) }
  }

  return (
    <>
      <SheetHeader><SheetTitle>Cuenta corriente — {proveedor.nombre}</SheetTitle></SheetHeader>
      <div className="mt-4 rounded-xl border border-border/60 bg-card px-4 py-3 flex items-center justify-between">
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

      <div className="mt-2 rounded-xl border border-border/60 bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Piso de reinversión</p>
            <p className="text-[11px] text-muted-foreground/70">Colchón reservado antes de contar ganancia limpia</p>
          </div>
          {!editandoPiso && (
            <div className="flex items-center gap-2">
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
      </div>

      <div className="mt-2 rounded-xl border border-border/60 bg-card px-4 py-3 space-y-2">
        <p className="text-[11px] text-muted-foreground/70">Para decidir el piso: lo que tenés y lo que vendés de este proveedor</p>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Costo del stock que tenés ahora</span>
          <span className="font-medium tabular-nums">{formatearARS(stockDeEste?.valorCostoCentavos ?? 0)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Precio de venta de ese mismo stock</span>
          <span className="font-medium tabular-nums">{formatearARS(stockDeEste?.valorVentaCentavos ?? 0)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total que facturaste este mes</span>
          <span className="font-medium tabular-nums">{formatearARS(ventasDeEste?.ventasCentavos ?? 0)}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button type="button" variant={modo === "pago" ? "default" : "outline"} onClick={() => setModo("pago")}>Registrar pago</Button>
        <Button type="button" variant={modo === "compra" ? "default" : "outline"} onClick={() => setModo("compra")}>Compra a crédito</Button>
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
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
                {cajasActivas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
    </>
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
  facturarAutomaticamente: z.boolean(),
})
type MedioPagoForm = z.infer<typeof medioPagoSchema>

const MEDIO_PAGO_DEFAULTS: MedioPagoForm = {
  nombre: "", comisionPct: 0, tipo: "digital", cajaId: null,
  recargoTipo: "PORCENTUAL", recargoVirtualPct: 0, recargoVirtualFijoPesos: 0,
  mpDispositivo: "qr", mpExternalPosId: "", mpTerminalId: "",
  facturarAutomaticamente: false,
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
      facturarAutomaticamente: m.facturarAutomaticamente,
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
      facturarAutomaticamente: data.facturarAutomaticamente,
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

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={watch("facturarAutomaticamente")}
                onCheckedChange={(c) => setValue("facturarAutomaticamente", c === true)}
              />
              <span>Facturar automáticamente por AFIP las ventas cobradas con este medio</span>
            </label>

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
  const [sheetMode, setSheetMode] = useState<"crear" | "editar" | "historial" | "pagar">("crear")
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
              const pendienteCentavos = Math.max(0, (montoActual?.montoCentavos ?? 0) - g.pagadoMesActualCentavos)
              const pagadoDelMesQueToca = montoActual?.mesAnio === mesActual && g.pagadoMesActualCentavos > 0
              return (
                <div key={g.id}>
                  <div className={cn("px-4 py-3 flex items-center gap-3")}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{g.nombre}</p>
                        {pagadoDelMesQueToca && (
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-md font-medium",
                            pendienteCentavos === 0 ? "bg-k-gain/10 text-k-gain" : "bg-k-loss/10 text-k-loss"
                          )}>
                            {pendienteCentavos === 0 ? "Pagado" : `Pagado ${formatearARS(g.pagadoMesActualCentavos)} de ${formatearARS(montoActual?.montoCentavos ?? 0)}`}
                          </span>
                        )}
                      </div>
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
                          {montoActual?.mesAnio === mesActual && pendienteCentavos > 0 && (
                            <Button
                              variant="ghost" size="icon-sm"
                              onClick={() => { setSelected(g); setSheetMode("pagar"); setSheetOpen(true) }}
                              title="Pagar"
                            >
                              <Wallet className="size-3.5" />
                            </Button>
                          )}
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
          {sheetMode === "pagar" && selected && (
            <GastoFijoPagarForm
              gasto={selected}
              mesActual={mesActual}
              onSuccess={() => { setSheetOpen(false); onMutate() }}
            />
          )}
        </SheetContent>
      </Sheet>
    </SectionShell>
  )
}

function GastoFijoPagarForm({ gasto, mesActual, onSuccess }: { gasto: GastoFijo; mesActual: string; onSuccess: () => void }) {
  const { data: cajas } = useConfig<CajaItem[]>("cajas")
  const montoActual = gasto.montos.find((m) => m.mesAnio === mesActual)
  const pendienteCentavos = Math.max(0, (montoActual?.montoCentavos ?? 0) - gasto.pagadoMesActualCentavos)

  const [monto, setMonto] = useState(String(pendienteCentavos / 100))
  const [cajaId, setCajaId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const cajasActivas = cajas?.filter((c) => c.activo) ?? []

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const montoCentavos = Math.round(parseFloat(monto) * 100)
    if (!montoCentavos || montoCentavos <= 0) { toast.error("Ingresá un monto válido"); return }
    if (!cajaId) { toast.error("Elegí de qué caja sale el pago"); return }
    setIsSubmitting(true)
    try {
      await pagarGastoFijoAction(gasto.id, montoCentavos, cajaId)
      toast.success(`Pago de "${gasto.nombre}" registrado`)
      onSuccess()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setIsSubmitting(false) }
  }

  return (
    <>
      <SheetHeader><SheetTitle>Pagar — {gasto.nombre}</SheetTitle></SheetHeader>
      <div className="mt-4 rounded-xl border border-border/60 bg-card px-4 py-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Pendiente este mes</p>
        <p className="text-lg font-semibold tabular-nums text-k-loss">{formatearARS(pendienteCentavos)}</p>
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <Field
          label="Monto ($)"
          type="number"
          step="0.01"
          min="0"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
        <div className="space-y-1.5">
          <Label>Caja de la que sale el pago</Label>
          <Select value={cajaId} onValueChange={(v) => setCajaId(v ?? "")}>
            <SelectTrigger><SelectValue placeholder="Elegí una caja" /></SelectTrigger>
            <SelectContent>
              {cajasActivas.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Registrar pago"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Se crea un egreso real en la caja elegida (tiene que estar abierta) y descuenta lo pagado de &ldquo;a pagar&rdquo; en Inicio.
        </p>
      </form>
    </>
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
// MOVIMIENTOS (historial)
// ═══════════════════════════════════════════════════════════════════════════════

interface MovimientoRow {
  id: string
  tipo: string
  montoCentavos: number
  recargoCentavos: number
  nota: string | null
  fecha: string
  caja: { nombre: string }
  medioPago: { nombre: string; esEfectivo: boolean } | null
  fixedExpense: { nombre: string } | null
  sale: { id: string; esConsumoInterno: boolean } | null
}
interface ArqueoParcialRow {
  id: string
  efectivoEsperadoCentavos: number
  efectivoContadoCentavos: number
  diferenciaCentavos: number
  nota: string | null
  fecha: string
  caja: { nombre: string }
  user: { nombre: string }
}

function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const TIPO_ESTILO: Record<string, string> = {
  VENTA: "bg-k-gain/10 text-k-gain",
  INGRESO: "bg-k-gain/10 text-k-gain",
  EGRESO: "bg-k-loss/10 text-k-loss",
  AJUSTE: "bg-muted text-muted-foreground",
}

function MovimientosSection() {
  const { data: cajas } = useConfig<CajaItem[]>("cajas")
  const [cajaId, setCajaId] = useState<string>("todas")
  const [desde, setDesde] = useState(hoyISO())
  const [hasta, setHasta] = useState(hoyISO())

  const { data, isLoading } = useQuery<MovimientoRow[]>({
    queryKey: ["movimientos-caja", cajaId, desde, hasta],
    queryFn: () => {
      const params = new URLSearchParams({ desde, hasta })
      if (cajaId !== "todas") params.set("cajaId", cajaId)
      return fetch(`/api/cajas/movimientos?${params}`).then((r) => r.json())
    },
    staleTime: 30_000,
  })

  const totalPorTipo = (data ?? []).reduce<Record<string, number>>((acc, m) => {
    const signo = m.tipo === "EGRESO" ? -1 : 1
    acc[m.tipo] = (acc[m.tipo] ?? 0) + signo * (m.montoCentavos + m.recargoCentavos)
    return acc
  }, {})

  return (
    <SectionShell title="Movimientos">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label>Caja</Label>
          <Select value={cajaId} onValueChange={(v) => setCajaId(v ?? "todas")}>
            <SelectTrigger className="rounded-xl w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las cajas</SelectItem>
              {(cajas ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Desde</Label>
          <input
            type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="h-9 rounded-xl border border-border/60 bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Hasta</Label>
          <input
            type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="h-9 rounded-xl border border-border/60 bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {!isLoading && data && data.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(totalPorTipo).map(([tipo, total]) => (
            <div key={tipo} className={cn("text-xs px-2.5 py-1 rounded-lg font-medium", TIPO_ESTILO[tipo])}>
              {tipo}: {formatearARS(total)}
            </div>
          ))}
        </div>
      )}

      {isLoading ? <SkeletonList /> : (
        <ListCard>
          {(data ?? []).length === 0 && <EmptyRow label="Sin movimientos en este rango" />}
          {(data ?? []).map((m) => (
            <div key={m.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md font-medium", TIPO_ESTILO[m.tipo])}>
                    {m.tipo}
                  </span>
                  <p className="text-sm font-medium truncate">{m.caja.nombre}</p>
                  {m.medioPago && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-foreground/8 text-muted-foreground font-medium">
                      {m.medioPago.nombre}
                    </span>
                  )}
                  {m.sale?.esConsumoInterno && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-foreground/8 text-muted-foreground font-medium">
                      Consumo interno
                    </span>
                  )}
                  {m.fixedExpense && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-foreground/8 text-muted-foreground font-medium">
                      Gasto fijo: {m.fixedExpense.nombre}
                    </span>
                  )}
                </div>
                {m.nota && <p className="text-xs text-muted-foreground truncate">{m.nota}</p>}
                <p className="text-[11px] text-muted-foreground/70">
                  {new Date(m.fecha).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <p className={cn(
                "text-sm font-semibold tabular-nums shrink-0",
                m.tipo === "EGRESO" ? "text-k-loss" : "text-k-gain"
              )}>
                {m.tipo === "EGRESO" ? "-" : "+"}{formatearARS(m.montoCentavos + m.recargoCentavos)}
              </p>
            </div>
          ))}
        </ListCard>
      )}

      <ArqueosParcialesList cajaId={cajaId} />
    </SectionShell>
  )
}

function ArqueosParcialesList({ cajaId }: { cajaId: string }) {
  const { data, isLoading } = useQuery<ArqueoParcialRow[]>({
    queryKey: ["arqueos-parciales", cajaId],
    queryFn: () => {
      const params = cajaId !== "todas" ? `?cajaId=${cajaId}` : ""
      return fetch(`/api/cajas/arqueos-parciales${params}`).then((r) => r.json())
    },
  })

  if (isLoading || !data || data.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground px-1">Arqueos de control (no cierran la caja)</p>
      <ListCard>
        {data.map((a) => (
          <div key={a.id} className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium truncate">{a.caja.nombre}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-foreground/8 text-muted-foreground font-medium">
                  {a.user.nombre}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Esperado {formatearARS(a.efectivoEsperadoCentavos)} · Contado {formatearARS(a.efectivoContadoCentavos)}
              </p>
              {a.nota && <p className="text-xs text-muted-foreground truncate">{a.nota}</p>}
              <p className="text-[11px] text-muted-foreground/70">
                {new Date(a.fecha).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <p className={cn(
              "text-sm font-semibold tabular-nums shrink-0",
              a.diferenciaCentavos === 0 ? "text-muted-foreground" : a.diferenciaCentavos > 0 ? "text-k-gain" : "text-k-loss"
            )}>
              {a.diferenciaCentavos >= 0 ? "+" : ""}{formatearARS(a.diferenciaCentavos)}
            </p>
          </div>
        ))}
      </ListCard>
    </div>
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
  facturacionModoProduccion: z.boolean(),
  imprimirTicketPosnet: z.boolean(),
  stockMinimoDefault: z.number().int().min(0),
  horariosArqueo: z.string().regex(/^\d{2}:\d{2}(,\d{2}:\d{2})*$/, "Formato: 14:00,19:00").optional().or(z.literal("")),
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
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<NegocioFormData>({
    resolver: zodResolver(negocioSchema),
    defaultValues: {
      nombre: data.nombre,
      cuit: data.cuit ?? "",
      condicionIva: (data.condicionIva as NegocioFormData["condicionIva"]) ?? undefined,
      puntoDeVenta: data.puntoDeVenta ?? undefined,
      facturacionModoProduccion: data.facturacionModoProduccion,
      imprimirTicketPosnet: data.imprimirTicketPosnet,
      stockMinimoDefault: data.stockMinimoDefault,
      horariosArqueo: data.horariosArqueo ?? "",
    },
  })
  const facturacionModoProduccion = watch("facturacionModoProduccion")
  const imprimirTicketPosnet = watch("imprimirTicketPosnet")

  async function onSubmit(formData: NegocioFormData) {
    if (
      formData.facturacionModoProduccion &&
      !data.facturacionModoProduccion &&
      !window.confirm(
        "Vas a activar la facturación en modo PRODUCCIÓN. A partir de ahora, las ventas que disparen facturación automática van a generar comprobantes fiscales reales con AFIP (CAE real, no anulable). ¿Confirmás?"
      )
    ) {
      return
    }
    try {
      await actualizarNegocioAction({
        nombre: formData.nombre,
        cuit: formData.cuit || null,
        condicionIva: formData.condicionIva || null,
        puntoDeVenta: formData.puntoDeVenta || null,
        facturacionModoProduccion: formData.facturacionModoProduccion,
        imprimirTicketPosnet: formData.imprimirTicketPosnet,
        stockMinimoDefault: formData.stockMinimoDefault,
        horariosArqueo: formData.horariosArqueo || null,
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
        <div className="space-y-1.5 rounded-xl border p-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={facturacionModoProduccion}
              onCheckedChange={(c) => setValue("facturacionModoProduccion", c === true)}
            />
            <span className="font-medium">Facturación AFIP en modo producción</span>
          </label>
          <p className="text-xs text-muted-foreground">
            {facturacionModoProduccion
              ? "Activado: las facturas automáticas son reales, con CAE real de AFIP, no anulables."
              : "Desactivado (homologación): las facturas se emiten contra el ambiente de pruebas de AFIP, sin validez fiscal."}
          </p>
        </div>
        <div className="space-y-1.5 rounded-xl border p-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={imprimirTicketPosnet}
              onCheckedChange={(c) => setValue("imprimirTicketPosnet", c === true)}
            />
            <span className="font-medium">Imprimir tiquet en el posnet al confirmar la venta</span>
          </label>
          <p className="text-xs text-muted-foreground">
            Manda el detalle de cada venta (ítems y total) a imprimir en la terminal Point configurada como
            posnet, sin importar con qué medio se pagó. Requiere tener un medio de pago Posnet activo.
          </p>
        </div>
        <Field
          label="Stock mínimo default (unidades)"
          type="number" min="0"
          {...register("stockMinimoDefault", { valueAsNumber: true })}
          error={errors.stockMinimoDefault?.message}
        />
        <Field
          label="Horarios de arqueo de control"
          placeholder="14:00,19:00"
          {...register("horariosArqueo")}
          error={errors.horariosArqueo?.message}
        />
        <p className="text-xs text-muted-foreground -mt-2">
          Conteos de control que NO cierran la caja, para detectar diferencias antes de que se acumulen
          muchas horas. Formato HH:mm separados por coma. Vacío = 14:00,19:00 por defecto.
        </p>
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

const crearPerfilPinSchema = z.object({
  nombre: z.string().min(1, "Requerido"),
  pin: z.string().regex(/^\d{4}$/, "Tiene que tener 4 dígitos"),
})
type CrearPerfilPinForm = z.infer<typeof crearPerfilPinSchema>

function UsuariosSection({ onMutate }: { onMutate: () => void }) {
  const { data: session } = useSession()
  const { data, isLoading } = useConfig<Usuario[]>("usuarios")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [modo, setModo] = useState<"login" | "pin">("login")
  const [pending, setPending] = useState<string | null>(null)
  const [resetPinUser, setResetPinUser] = useState<Usuario | null>(null)

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<CrearUsuarioForm>({
    resolver: zodResolver(crearUsuarioSchema),
    defaultValues: { role: "VENDEDOR" },
  })
  const {
    register: registerPin, handleSubmit: handleSubmitPin, reset: resetPin,
    formState: { errors: errorsPin, isSubmitting: isSubmittingPin },
  } = useForm<CrearPerfilPinForm>({ resolver: zodResolver(crearPerfilPinSchema) })

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

  async function onSubmitPin(formData: CrearPerfilPinForm) {
    try {
      await crearPerfilPinAction(formData)
      toast.success("Perfil creado")
      setSheetOpen(false)
      resetPin()
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
        <Button
          size="sm"
          onClick={() => { setModo("login"); reset({ role: "VENDEDOR" }); resetPin(); setSheetOpen(true) }}
          className="gap-1.5"
        >
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
                  {u.tienePin && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-foreground/8 text-muted-foreground font-medium">PIN</span>
                  )}
                  {!u.activo && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">Inactivo</span>
                  )}
                </div>
                {u.email && <p className="text-xs text-muted-foreground">{u.email}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {pending === u.id && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                {pending !== u.id && (
                  <>
                    <Button
                      variant="ghost" size="icon-sm"
                      onClick={() => setResetPinUser(u)}
                      title={u.tienePin ? "Resetear PIN" : "Asignar PIN"}
                    >
                      <KeyRound className="size-3.5" />
                    </Button>
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
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button type="button" variant={modo === "login" ? "default" : "outline"} onClick={() => setModo("login")}>
              Con login
            </Button>
            <Button type="button" variant={modo === "pin" ? "default" : "outline"} onClick={() => setModo("pin")}>
              Perfil con PIN
            </Button>
          </div>

          {modo === "login" ? (
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
          ) : (
            <form onSubmit={handleSubmitPin(onSubmitPin)} className="mt-6 space-y-4">
              <Field label="Nombre" {...registerPin("nombre")} error={errorsPin.nombre?.message} />
              <Field
                label="PIN (4 dígitos)" inputMode="numeric" maxLength={4}
                {...registerPin("pin")} error={errorsPin.pin?.message}
              />
              <p className="text-xs text-muted-foreground">
                Sin email ni contraseña — solo sirve para el cambio rápido de perfil en el kiosco. Siempre
                se crea como Vendedor.
              </p>
              <Button type="submit" className="w-full" disabled={isSubmittingPin}>
                {isSubmittingPin ? <Loader2 className="size-4 animate-spin" /> : "Crear perfil"}
              </Button>
            </form>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!resetPinUser} onOpenChange={(v) => !v && setResetPinUser(null)}>
        <SheetContent>
          {resetPinUser && (
            <ResetearPinForm usuario={resetPinUser} onSuccess={() => { setResetPinUser(null); onMutate() }} />
          )}
        </SheetContent>
      </Sheet>
    </SectionShell>
  )
}

function ResetearPinForm({ usuario, onSuccess }: { usuario: Usuario; onSuccess: () => void }) {
  const [pin, setPin] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d{4}$/.test(pin)) { toast.error("El PIN debe tener 4 dígitos"); return }
    setIsSubmitting(true)
    try {
      await resetearPinUsuarioAction(usuario.id, pin)
      toast.success(`PIN de "${usuario.nombre}" actualizado`)
      onSuccess()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setIsSubmitting(false) }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{usuario.tienePin ? "Resetear" : "Asignar"} PIN — {usuario.nombre}</SheetTitle>
      </SheetHeader>
      {usuario.role === "ADMIN" && (
        <p className="mt-4 text-xs text-k-loss bg-k-loss/10 rounded-lg px-3 py-2">
          Esta es una cuenta Admin. Cualquiera con acceso físico al kiosco que sepa este PIN va a poder
          entrar con sesión de administrador completa (precios, usuarios, configuración, todo).
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field
          label="Nuevo PIN (4 dígitos)"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
        </Button>
      </form>
    </>
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
