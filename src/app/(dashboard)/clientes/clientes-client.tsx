"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Plus, Wallet, Loader2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { formatearARS } from "@/domain/dinero"
import { Field, ListCard, ActionRow } from "@/components/config/list-primitives"
import { Skeleton } from "@/components/ui/skeleton"
import { stagger } from "@/lib/motion"
import {
  crearClienteAction, editarClienteAction, desactivarClienteAction, reactivarClienteAction,
  registrarPagoDeudaClienteAction, registrarDeudaManualClienteAction,
} from "@/app/actions/clientes.actions"

interface Cliente {
  id: string
  nombre: string
  telefono: string | null
  direccion: string | null
  activo: boolean
  saldoCuentaCorrienteCentavos: number
}

interface CajaConSesion {
  id: string
  nombre: string
  sesiones: { id: string }[]
}

interface VentaFiada {
  id: string
  fecha: string
  totalCentavos: number
  fiadoCentavos: number
}

export function ClientesClient() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<Cliente[]>({
    queryKey: ["clientes"],
    queryFn: () => fetch("/api/clientes").then((r) => r.json()),
    staleTime: 60_000,
  })

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [cuentaCliente, setCuentaCliente] = useState<Cliente | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  function invalidar() { qc.invalidateQueries({ queryKey: ["clientes"] }) }

  function abrirCrear() { setEditing(null); setSheetOpen(true) }
  function abrirEditar(c: Cliente) { setEditing(c); setSheetOpen(true) }

  async function toggle(c: Cliente) {
    setPending(c.id)
    try {
      if (c.activo) await desactivarClienteAction(c.id)
      else await reactivarClienteAction(c.id)
      toast.success(c.activo ? `"${c.nombre}" desactivado` : `"${c.nombre}" reactivado`)
      invalidar()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setPending(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-medium">Clientes</h1>
        <Button size="sm" onClick={abrirCrear} className="gap-1.5"><Plus className="size-3.5" /> Nuevo</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}
        </div>
      ) : data?.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Users className="size-8" />
          <p className="text-sm">Sin clientes todavía</p>
        </div>
      ) : (
        <motion.div variants={stagger.container} initial="hidden" animate="show">
          <ListCard>
            {data?.map((c) => (
              <motion.div key={c.id} variants={stagger.item}>
                <ActionRow
                  primary={c.nombre}
                  secondary={c.telefono ?? undefined}
                  activo={c.activo}
                  isPending={pending === c.id}
                  onEdit={() => abrirEditar(c)}
                  onToggle={() => toggle(c)}
                  badge={c.saldoCuentaCorrienteCentavos > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-k-loss/10 text-k-loss font-medium">
                      Debe {formatearARS(c.saldoCuentaCorrienteCentavos)}
                    </span>
                  )}
                  extraAction={
                    <Button variant="ghost" size="icon-sm" onClick={() => setCuentaCliente(c)} title="Cuenta corriente">
                      <Wallet className="size-3.5" />
                    </Button>
                  }
                />
              </motion.div>
            ))}
          </ListCard>
        </motion.div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <ClienteForm
            editing={editing}
            onSuccess={() => { setSheetOpen(false); invalidar() }}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={!!cuentaCliente} onOpenChange={(v) => !v && setCuentaCliente(null)}>
        <SheetContent>
          {cuentaCliente && (
            <CuentaCorrienteSheet
              cliente={cuentaCliente}
              onSuccess={() => { setCuentaCliente(null); invalidar() }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function ClienteForm({ editing, onSuccess }: { editing: Cliente | null; onSuccess: () => void }) {
  const [nombre, setNombre] = useState(editing?.nombre ?? "")
  const [telefono, setTelefono] = useState(editing?.telefono ?? "")
  const [direccion, setDireccion] = useState(editing?.direccion ?? "")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) { toast.error("El nombre es obligatorio"); return }
    setIsSubmitting(true)
    try {
      const data = { nombre: nombre.trim(), telefono: telefono || undefined, direccion: direccion || undefined }
      if (editing) {
        await editarClienteAction(editing.id, data)
        toast.success("Cliente actualizado")
      } else {
        await crearClienteAction(data)
        toast.success("Cliente creado")
      }
      onSuccess()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setIsSubmitting(false) }
  }

  return (
    <>
      <SheetHeader><SheetTitle>{editing ? "Editar cliente" : "Nuevo cliente"}</SheetTitle></SheetHeader>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Nombre" autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Field label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        <Field label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : editing ? "Guardar" : "Crear"}
        </Button>
      </form>
    </>
  )
}

function CuentaCorrienteSheet({ cliente, onSuccess }: { cliente: Cliente; onSuccess: () => void }) {
  const { data: cajas } = useQuery<CajaConSesion[]>({
    queryKey: ["cajas-panel"],
    queryFn: () => fetch("/api/cajas").then((r) => r.json()),
    staleTime: 5 * 60_000,
  })
  const { data: ventasFiadas } = useQuery<VentaFiada[]>({
    queryKey: ["cliente-ventas-fiadas", cliente.id],
    queryFn: () => fetch(`/api/clientes/${cliente.id}/ventas-fiadas`).then((r) => r.json()),
    staleTime: 60_000,
  })

  const [modo, setModo] = useState<"pago" | "cargar">(cliente.saldoCuentaCorrienteCentavos > 0 ? "pago" : "cargar")
  const [monto, setMonto] = useState("")
  const [cajaId, setCajaId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const cajasAbiertas = cajas?.filter((c) => c.sesiones.length > 0) ?? []

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const montoCentavos = Math.round(parseFloat(monto) * 100)
    if (!montoCentavos || montoCentavos <= 0) { toast.error("Ingresá un monto válido"); return }
    setIsSubmitting(true)
    try {
      if (modo === "pago") {
        if (!cajaId) { toast.error("Elegí a qué caja entra el pago"); return }
        await registrarPagoDeudaClienteAction(cliente.id, montoCentavos, cajaId)
        toast.success("Pago registrado")
      } else {
        await registrarDeudaManualClienteAction(cliente.id, montoCentavos)
        toast.success("Deuda cargada")
      }
      onSuccess()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setIsSubmitting(false) }
  }

  return (
    <>
      <SheetHeader><SheetTitle>Cuenta corriente — {cliente.nombre}</SheetTitle></SheetHeader>
      <div className="mt-4 rounded-xl border border-border/60 bg-card px-4 py-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Nos debe</p>
        <p className="text-lg font-semibold tabular-nums text-k-loss">{formatearARS(cliente.saldoCuentaCorrienteCentavos)}</p>
      </div>

      {ventasFiadas && ventasFiadas.length > 0 && (
        <div className="mt-2 rounded-xl border border-border/60 bg-card px-4 py-3 space-y-1.5">
          <p className="text-[11px] text-muted-foreground/70">Ventas con saldo fiado</p>
          {ventasFiadas.map((v) => (
            <div key={v.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {new Date(v.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })} · {formatearARS(v.totalCentavos)}
              </span>
              <span className="font-medium tabular-nums text-k-loss">{formatearARS(v.fiadoCentavos)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button type="button" variant={modo === "cargar" ? "default" : "outline"} onClick={() => setModo("cargar")}>
          Cargar deuda
        </Button>
        <Button type="button" variant={modo === "pago" ? "default" : "outline"} onClick={() => setModo("pago")}>
          Registrar pago
        </Button>
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label>Monto ($)</Label>
          <input
            type="number" step="0.01" min="0" autoFocus
            value={monto} onChange={(e) => setMonto(e.target.value)}
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {modo === "pago" && (
          <div className="space-y-1.5">
            <Label>Entra a la caja</Label>
            <select
              value={cajaId} onChange={(e) => setCajaId(e.target.value)}
              className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Elegir caja</option>
              {cajasAbiertas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            {cajasAbiertas.length === 0 && (
              <p className="text-xs text-k-loss">No hay ninguna caja abierta — abrí una para registrar el pago.</p>
            )}
          </div>
        )}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : modo === "pago" ? "Registrar pago" : "Cargar deuda"}
        </Button>
      </form>
    </>
  )
}
