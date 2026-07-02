"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { ShoppingCart, AlertTriangle, TrendingUp, Zap, Wallet, ArrowDownLeft, ArrowUpRight, Loader2, FileText } from "lucide-react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { EquilibrioBar } from "@/components/ui/equilibrio-bar"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { formatearARS } from "@/domain/dinero"
import { cn } from "@/lib/utils"
import { cerrarCajaAction, registrarMovimientoAction } from "@/app/actions/cajaSesion.actions"
import { AbrirCajaSheet } from "@/components/pos/abrir-caja-sheet"

interface ResumenHoy {
  ventasCentavos: number
  gananciaBrutaCentavos: number
  comisionesTotalesCentavos: number
  cantidadVentas: number
  gananciaNeta: number
}

interface ResumenMes {
  gananciaNetaCentavos: number
  pctAvance: number
  faltanteCentavos: number
  cubierto: boolean
  gastosFijosCentavos: number
  gananciaBrutaCentavos: number
  comisionesTotalesCentavos: number
}

interface ResumenData {
  hoy: ResumenHoy
  mes: ResumenMes
  stockBajo: { id: string; nombre: string; stock: number; stockMinimo: number }[]
}

interface FilaProveedor {
  id: string
  nombre: string
  gananciaBrutaCentavos: number
}

// ─── Cajas Panel ─────────────────────────────────────────────────────────────

interface CajaMovimiento {
  tipo: string
  montoCentavos: number
  recargoCentavos: number
  medioPago: { esEfectivo: boolean } | null
}

interface SesionZResult {
  caja: { nombre: string }
  fondoInicialCentavos: number
  fechaApertura: string
  fechaCierre: string | null
  efectivoEsperadoCentavos: number | null
  efectivoContadoCentavos: number | null
  diferenciaCentavos: number | null
  nota: string | null
  abiertaPor: { nombre: string }
  cerradaPor: { nombre: string } | null
  movimientos: CajaMovimiento[]
}

function computeSessionTotals(movimientos: CajaMovimiento[], fondoInicialCentavos: number) {
  const ventasEfectivo = movimientos.filter((m) => m.tipo === "VENTA" && m.medioPago?.esEfectivo).reduce((s, m) => s + m.montoCentavos, 0)
  const ventasDigital = movimientos.filter((m) => m.tipo === "VENTA" && !m.medioPago?.esEfectivo).reduce((s, m) => s + m.montoCentavos, 0)
  const recargo = movimientos.filter((m) => m.tipo === "VENTA").reduce((s, m) => s + m.recargoCentavos, 0)
  const ingresos = movimientos.filter((m) => m.tipo === "INGRESO").reduce((s, m) => s + m.montoCentavos, 0)
  const egresos = movimientos.filter((m) => m.tipo === "EGRESO").reduce((s, m) => s + m.montoCentavos, 0)
  const nVentas = movimientos.filter((m) => m.tipo === "VENTA").length
  const efectivoEnCaja = fondoInicialCentavos + ventasEfectivo + ingresos - egresos
  return { ventasEfectivo, ventasDigital, recargo, ingresos, egresos, nVentas, efectivoEnCaja }
}
interface CajaSesionPanel {
  id: string
  fondoInicialCentavos: number
  fechaApertura: string
  abiertaPor: { nombre: string }
  movimientos: CajaMovimiento[]
}
interface CajaPanelItem {
  id: string
  nombre: string
  esPrincipal: boolean
  sesiones: CajaSesionPanel[]
}

function calcEfectivoEnCaja(s: CajaSesionPanel): number {
  let total = s.fondoInicialCentavos
  for (const m of s.movimientos) {
    if (m.tipo === "INGRESO") total += m.montoCentavos
    else if (m.tipo === "EGRESO") total -= m.montoCentavos
    else if (m.tipo === "VENTA" && m.medioPago?.esEfectivo) total += m.montoCentavos
  }
  return total
}

function horaCorta(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
}

type PanelMode = "abrir" | "cerrar" | "movimiento" | "detalle"

function CajasPanel() {
  const qc = useQueryClient()
  const { data: cajas, isLoading, dataUpdatedAt } = useQuery<CajaPanelItem[]>({
    queryKey: ["cajas-panel"],
    queryFn: () => fetch("/api/cajas").then((r) => r.json()),
  })

  const [mode, setMode] = useState<PanelMode | null>(null)
  const [cajaId, setCajaId] = useState<string | null>(null)
  const [sesionId, setSesionId] = useState<string | null>(null)
  const [cajaNombre, setCajaNombre] = useState("")
  const [expectedCash, setExpectedCash] = useState(0)
  const [sesionData, setSesionData] = useState<CajaSesionPanel | null>(null)

  function invalidar() { qc.invalidateQueries({ queryKey: ["cajas-panel"] }) }

  function openAbrir(c: CajaPanelItem) {
    setCajaId(c.id); setCajaNombre(c.nombre); setMode("abrir")
  }
  function openCerrar(c: CajaPanelItem, s: CajaSesionPanel) {
    setSesionId(s.id); setCajaNombre(c.nombre); setExpectedCash(calcEfectivoEnCaja(s)); setMode("cerrar")
  }
  function openMovimiento(c: CajaPanelItem, s: CajaSesionPanel) {
    setSesionId(s.id); setCajaNombre(c.nombre); setMode("movimiento")
  }
  function openDetalle(c: CajaPanelItem, s: CajaSesionPanel) {
    setSesionId(s.id); setCajaNombre(c.nombre); setSesionData(s); setMode("detalle")
  }

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : null

  return (
    <>
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="px-4 pt-3.5 pb-2.5 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="size-3.5 text-muted-foreground" />
            <p className="text-sm font-medium">Cajas</p>
          </div>
          {lastUpdate && (
            <p className="text-[10px] text-muted-foreground/50">{lastUpdate}</p>
          )}
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-11 rounded-lg" />
            <Skeleton className="h-11 rounded-lg" />
          </div>
        ) : !cajas?.length ? (
          <p className="px-4 py-3 text-xs text-muted-foreground">
            Sin cajas · <Link href="/config" className="underline underline-offset-2">Configurar</Link>
          </p>
        ) : (
          <div className="divide-y divide-border/40">
            {cajas.map((caja) => {
              const sesion = caja.sesiones[0]
              const abierta = !!sesion
              const enCaja = abierta ? calcEfectivoEnCaja(sesion) : 0
              const nMov = sesion?.movimientos.length ?? 0

              return (
                <div key={caja.id} className="px-4 py-2.5 flex items-center gap-3 min-h-[52px]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("size-1.5 rounded-full shrink-0", abierta ? "bg-green-500" : "bg-border")} />
                      <p className="text-sm font-medium truncate">{caja.nombre}</p>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-md font-medium",
                        abierta
                          ? "bg-green-500/15 text-green-700 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {abierta ? "ABIERTA" : "CERRADA"}
                      </span>
                    </div>
                    {abierta && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        desde {horaCorta(sesion.fechaApertura)} · {sesion.abiertaPor.nombre}
                        {nMov > 0 && ` · ${nMov} mov.`}
                      </p>
                    )}
                  </div>

                  {abierta && (
                    <div className="text-right shrink-0">
                      <p className={cn("text-sm font-semibold tabular-nums", enCaja >= 0 ? "text-k-gain" : "text-k-loss")}>
                        {formatearARS(enCaja)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">en caja</p>
                    </div>
                  )}

                  <div className="flex items-center gap-1 shrink-0">
                    {abierta ? (
                      <>
                        <Button
                          variant="ghost" size="icon-sm"
                          title="Ver detalle del turno"
                          onClick={() => openDetalle(caja, sesion)}
                        >
                          <FileText className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon-sm"
                          title="Registrar movimiento"
                          onClick={() => openMovimiento(caja, sesion)}
                        >
                          <ArrowUpRight className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="text-xs h-7 px-2.5"
                          onClick={() => openCerrar(caja, sesion)}
                        >
                          Cerrar
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost" size="sm"
                        className="text-xs h-7 px-2.5"
                        onClick={() => openAbrir(caja)}
                      >
                        Abrir
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Sheet open={mode !== null} onOpenChange={(v) => { if (!v) setMode(null) }}>
        <SheetContent>
          {mode === "abrir" && cajaId && (
            <AbrirCajaSheet
              cajaNombre={cajaNombre}
              cajaId={cajaId}
              onSuccess={() => { setMode(null); invalidar() }}
            />
          )}
          {mode === "cerrar" && sesionId && (
            <CerrarCajaSheet
              cajaNombre={cajaNombre}
              sesionId={sesionId}
              efectivoEsperado={expectedCash}
              onSuccess={() => { setMode(null); invalidar() }}
            />
          )}
          {mode === "movimiento" && sesionId && (
            <MovimientoCajaSheet
              cajaNombre={cajaNombre}
              sesionId={sesionId}
              onSuccess={() => { setMode(null); invalidar() }}
            />
          )}
          {mode === "detalle" && sesionData && (
            <CajaDetalleSheet cajaNombre={cajaNombre} sesion={sesionData} />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

const cerrarFormSchema = z.object({ pesos: z.number().min(0), nota: z.string().optional() })

function CerrarCajaSheet({ cajaNombre, sesionId, efectivoEsperado, onSuccess }: {
  cajaNombre: string; sesionId: string; efectivoEsperado: number; onSuccess: () => void
}) {
  const [zResult, setZResult] = useState<SesionZResult | null>(null)
  const { register, handleSubmit, watch, formState: { isSubmitting, errors } } = useForm<z.infer<typeof cerrarFormSchema>>({
    resolver: zodResolver(cerrarFormSchema),
    defaultValues: { pesos: 0 },
  })
  const pesosContados = watch("pesos") ?? 0
  const centavosContados = Math.round((Number(pesosContados) || 0) * 100)
  const diferencia = centavosContados - efectivoEsperado

  async function onSubmit(data: z.infer<typeof cerrarFormSchema>) {
    try {
      const result = await cerrarCajaAction(sesionId, {
        efectivoContadoCentavos: Math.round(data.pesos * 100),
        nota: data.nota,
      })
      setZResult(result as unknown as SesionZResult)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error al cerrar") }
  }

  if (zResult) {
    const t = computeSessionTotals(zResult.movimientos, zResult.fondoInicialCentavos)
    const dif = zResult.diferenciaCentavos ?? 0
    return (
      <>
        <SheetHeader><SheetTitle>Cierre Z · {cajaNombre}</SheetTitle></SheetHeader>
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-border/60 bg-muted/10 divide-y divide-border/40">
            <Row label="Ventas efectivo" value={t.ventasEfectivo} />
            <Row label="Ventas digital" value={t.ventasDigital} />
            {t.recargo > 0 && <Row label="Recargo cobrado" value={t.recargo} muted />}
            {t.ingresos > 0 && <Row label="Ingresos manuales" value={t.ingresos} />}
            {t.egresos > 0 && <Row label="Egresos manuales" value={-t.egresos} />}
            <Row label="Fondo inicial" value={zResult.fondoInicialCentavos} muted />
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/5 divide-y divide-border/40">
            <Row label="Efectivo esperado" value={zResult.efectivoEsperadoCentavos ?? 0} />
            <Row label="Efectivo contado" value={zResult.efectivoContadoCentavos ?? 0} />
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm">Diferencia</span>
              <span className={cn(
                "text-sm tabular-nums font-semibold",
                dif > 0 ? "text-k-gain" : dif < 0 ? "text-k-loss" : "text-muted-foreground"
              )}>
                {dif >= 0 ? "+" : ""}{formatearARS(dif)}
              </span>
            </div>
          </div>
          {zResult.nota && (
            <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-2.5">
              <p className="text-xs text-muted-foreground mb-0.5">Nota</p>
              <p className="text-sm">{zResult.nota}</p>
            </div>
          )}
          <Button className="w-full" onClick={onSuccess}>Listo</Button>
        </div>
      </>
    )
  }

  return (
    <>
      <SheetHeader><SheetTitle>Cerrar {cajaNombre}</SheetTitle></SheetHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Efectivo esperado</span>
            <span className="font-semibold tabular-nums">{formatearARS(efectivoEsperado)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Diferencia</span>
            <span className={cn(
              "font-semibold tabular-nums",
              diferencia > 0 ? "text-k-gain" : diferencia < 0 ? "text-k-loss" : "text-muted-foreground"
            )}>
              {diferencia >= 0 ? "+" : ""}{formatearARS(diferencia)}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Efectivo contado ($)</label>
          <input
            type="number" step="0.01" min="0"
            {...register("pesos", { valueAsNumber: true })}
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {errors.pesos && <p className="text-xs text-k-loss">{errors.pesos.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Nota (opcional)</label>
          <input
            type="text" {...register("nota")}
            placeholder="Observación..."
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Cerrar caja"}
        </Button>
      </form>
    </>
  )
}

const movFormSchema = z.object({
  tipo: z.enum(["INGRESO", "EGRESO"]),
  pesos: z.number().min(0.01, "Monto requerido"),
  nota: z.string().optional(),
})

function MovimientoCajaSheet({ cajaNombre, sesionId, onSuccess }: {
  cajaNombre: string; sesionId: string; onSuccess: () => void
}) {
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting, errors } } = useForm<z.infer<typeof movFormSchema>>({
    resolver: zodResolver(movFormSchema),
    defaultValues: { tipo: "INGRESO", pesos: 0 },
  })
  const tipo = watch("tipo")

  async function onSubmit(data: z.infer<typeof movFormSchema>) {
    try {
      await registrarMovimientoAction(sesionId, {
        tipo: data.tipo,
        montoCentavos: Math.round(data.pesos * 100),
        nota: data.nota,
      })
      toast.success(data.tipo === "INGRESO" ? "Ingreso registrado" : "Egreso registrado")
      onSuccess()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
  }

  return (
    <>
      <SheetHeader><SheetTitle>Movimiento · {cajaNombre}</SheetTitle></SheetHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(["INGRESO", "EGRESO"] as const).map((t) => (
            <button
              key={t} type="button"
              onClick={() => setValue("tipo", t)}
              className={cn(
                "rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                tipo === t
                  ? t === "INGRESO"
                    ? "border-k-gain bg-k-gain/10 text-k-gain"
                    : "border-k-loss bg-k-loss/10 text-k-loss"
                  : "border-border/60 text-muted-foreground hover:bg-muted/20"
              )}
            >
              {t === "INGRESO"
                ? <><ArrowDownLeft className="size-3.5" /> Ingreso</>
                : <><ArrowUpRight className="size-3.5" /> Egreso</>}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Monto ($)</label>
          <input
            type="number" step="0.01" min="0"
            {...register("pesos", { valueAsNumber: true })}
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {errors.pesos && <p className="text-xs text-k-loss">{errors.pesos.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Nota (opcional)</label>
          <input
            type="text" {...register("nota")}
            placeholder="Retiro para proveedor, cambio..."
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : tipo === "INGRESO" ? "Registrar ingreso" : "Registrar egreso"}
        </Button>
      </form>
    </>
  )
}

function CajaDetalleSheet({ cajaNombre, sesion }: { cajaNombre: string; sesion: CajaSesionPanel }) {
  const t = computeSessionTotals(sesion.movimientos, sesion.fondoInicialCentavos)

  return (
    <>
      <SheetHeader>
        <SheetTitle>Turno · {cajaNombre}</SheetTitle>
      </SheetHeader>
      <div className="mt-5 space-y-1 text-xs text-muted-foreground">
        <span>Desde {horaCorta(sesion.fechaApertura)} · {sesion.abiertaPor.nombre}</span>
      </div>

      <div className="mt-5 space-y-2">
        <div className="rounded-xl border border-border/60 bg-muted/10 divide-y divide-border/40">
          <Row label="Ventas efectivo" value={t.ventasEfectivo} />
          <Row label="Ventas digital" value={t.ventasDigital} />
          {t.recargo > 0 && <Row label="Recargo cobrado" value={t.recargo} muted />}
          {t.ingresos > 0 && <Row label="Ingresos manuales" value={t.ingresos} />}
          {t.egresos > 0 && <Row label="Egresos manuales" value={-t.egresos} />}
          <Row label="Fondo inicial" value={sesion.fondoInicialCentavos} muted />
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/5 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium">Efectivo en caja</span>
          <span className={cn(
            "text-xl font-semibold tabular-nums",
            t.efectivoEnCaja >= 0 ? "text-k-gain" : "text-k-loss"
          )}>
            {formatearARS(t.efectivoEnCaja)}
          </span>
        </div>

        <p className="text-[10px] text-muted-foreground text-center pt-1">
          {t.nVentas} {t.nVentas === 1 ? "venta" : "ventas"} en este turno
        </p>
      </div>
    </>
  )
}

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className={cn("text-sm", muted ? "text-muted-foreground" : "")}>{label}</span>
      <span className={cn(
        "text-sm tabular-nums font-medium",
        muted ? "text-muted-foreground" : value < 0 ? "text-k-loss" : ""
      )}>
        {value < 0 ? `-${formatearARS(-value)}` : formatearARS(value)}
      </span>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.03 } } },
  item: {
    hidden: { opacity: 0, y: 6 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 280, damping: 28 } },
  },
}

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

export default function DashboardClient() {
  const { data, isLoading } = useQuery<ResumenData>({
    queryKey: ["resumen"],
    queryFn: () => fetch("/api/resumen").then((r) => r.json()),
  })

  const today = getToday()
  const { data: proveedoresHoy } = useQuery<FilaProveedor[]>({
    queryKey: ["rentabilidad-hoy", today],
    queryFn: () =>
      fetch(`/api/rentabilidad?por=proveedor&desde=${today}&hasta=${today}`).then((r) => r.json()),
  })

  if (isLoading || !data) {
    return (
      <div className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-10 w-44 rounded-lg" />
          </div>
          <div className="flex gap-4 pb-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-16 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="lg:grid lg:grid-cols-[1.55fr_1fr] lg:gap-4 space-y-4 lg:space-y-0">
          <div className="space-y-4">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  const { hoy, mes } = data
  const stockBajo = data.stockBajo ?? []
  const margenPct =
    hoy.ventasCentavos > 0
      ? Math.round((hoy.gananciaBrutaCentavos / hoy.ventasCentavos) * 100)
      : 0

  const topProveedores = ((proveedoresHoy ?? []) as FilaProveedor[])
    .filter((p) => p.gananciaBrutaCentavos > 0)
    .sort((a, b) => b.gananciaBrutaCentavos - a.gananciaBrutaCentavos)
    .slice(0, 4)

  return (
    <motion.div className="space-y-5" variants={stagger.container} initial="hidden" animate="show">

      {/* ── Hero inline: ganancia neta + chips del día ─────────────────────────── */}
      <motion.div
        variants={stagger.item}
        className="flex items-end justify-between gap-4 flex-wrap"
      >
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Hoy · Ganancia neta
          </p>
          <h1 className={cn(
            "text-4xl font-semibold tabular-nums tracking-tight font-mono",
            hoy.gananciaNeta > 0 ? "text-k-gain" : hoy.gananciaNeta < 0 ? "text-k-loss" : ""
          )}>
            {formatearARS(hoy.gananciaNeta)}
          </h1>
        </div>
        <div className="flex items-center gap-4 pb-0.5 shrink-0">
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Ventas</p>
            <p className="text-sm font-semibold tabular-nums">{formatearARS(hoy.ventasCentavos)}</p>
          </div>
          <div className="w-px h-7 bg-border/60" />
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Tickets</p>
            <p className="text-sm font-semibold tabular-nums">{hoy.cantidadVentas}</p>
          </div>
          <div className="w-px h-7 bg-border/60" />
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Margen</p>
            <p className="text-sm font-semibold tabular-nums">{margenPct}%</p>
          </div>
        </div>
      </motion.div>

      {/* ── Panel de cajas ─────────────────────────────────────────────────────── */}
      <motion.div variants={stagger.item}>
        <CajasPanel />
      </motion.div>

      {/* ── Dashboard grid 2 columnas ───────────────────────────────────────────── */}
      <motion.div
        variants={stagger.item}
        className="lg:grid lg:grid-cols-[1.55fr_1fr] lg:gap-4 space-y-4 lg:space-y-0"
      >
        {/* Columna izquierda */}
        <div className="space-y-4">

          {/* Equilibrio del mes */}
          <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Equilibrio del mes</p>
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full",
                mes.cubierto
                  ? "bg-k-gain-muted text-k-gain"
                  : "bg-muted text-muted-foreground"
              )}>
                {mes.cubierto ? "Cubierto" : "En curso"}
              </span>
            </div>
            <EquilibrioBar pctAvance={mes.pctAvance} cubierto={mes.cubierto} />
            <div className="grid grid-cols-3 gap-x-2 pt-1 text-sm">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Gastos fijos</p>
                <p className="font-semibold tabular-nums text-[13px] truncate">
                  {formatearARS(mes.gastosFijosCentavos)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Bruta del mes</p>
                <p className="font-semibold tabular-nums text-[13px] text-k-gain truncate">
                  {formatearARS(mes.gananciaBrutaCentavos)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">
                  {mes.cubierto ? "Neta del mes" : "Faltante"}
                </p>
                <p className={cn(
                  "font-semibold tabular-nums text-[13px] truncate",
                  mes.cubierto ? "text-k-gain" : "text-k-loss"
                )}>
                  {mes.cubierto
                    ? formatearARS(mes.gananciaNetaCentavos)
                    : formatearARS(mes.faltanteCentavos)}
                </p>
              </div>
            </div>
          </div>

          {/* Métricas bruta + comisiones */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <p className="text-xs text-muted-foreground">Ganancia bruta hoy</p>
              <p className={cn(
                "text-lg font-semibold tabular-nums mt-1",
                hoy.gananciaBrutaCentavos > 0 ? "text-k-gain" : ""
              )}>
                {formatearARS(hoy.gananciaBrutaCentavos)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <p className="text-xs text-muted-foreground">Comisiones hoy</p>
              <p className={cn(
                "text-lg font-semibold tabular-nums mt-1",
                hoy.comisionesTotalesCentavos > 0 ? "text-k-loss" : ""
              )}>
                {formatearARS(hoy.comisionesTotalesCentavos)}
              </p>
            </div>
          </div>

          {/* Accesos rápidos */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/vender" className="block">
              <div className="rounded-2xl border border-border/60 bg-card hover:bg-muted/30 transition-colors p-4 flex items-center gap-3">
                <div className="rounded-xl bg-foreground/8 p-2.5 shrink-0">
                  <Zap className="size-4 text-foreground/70" />
                </div>
                <div>
                  <p className="text-sm font-medium">Vender</p>
                  <p className="text-xs text-muted-foreground">Nueva venta</p>
                </div>
              </div>
            </Link>
            <Link href="/rentabilidad" className="block">
              <div className="rounded-2xl border border-border/60 bg-card hover:bg-muted/30 transition-colors p-4 flex items-center gap-3">
                <div className="rounded-xl bg-foreground/8 p-2.5 shrink-0">
                  <TrendingUp className="size-4 text-foreground/70" />
                </div>
                <div>
                  <p className="text-sm font-medium">Rentabilidad</p>
                  <p className="text-xs text-muted-foreground">Ver análisis</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Columna derecha */}
        <div className="space-y-4">

          {/* Dónde ganás hoy */}
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="px-4 pt-4 pb-2.5 border-b border-border/40">
              <p className="text-sm font-medium">Dónde ganás hoy</p>
              <p className="text-xs text-muted-foreground">Por proveedor · ganancia bruta</p>
            </div>
            {topProveedores.length === 0 ? (
              <div className="px-4 py-4">
                <p className="text-xs text-muted-foreground">
                  {hoy.cantidadVentas === 0 ? "Sin ventas registradas hoy" : "Sin datos de proveedor"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {topProveedores.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-xs text-muted-foreground/50 tabular-nums w-3 shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-sm flex-1 truncate">{p.nombre}</p>
                    <p className="text-sm font-semibold tabular-nums text-k-gain shrink-0">
                      {formatearARS(p.gananciaBrutaCentavos)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stock bajo */}
          {stockBajo.length > 0 ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <AlertTriangle className="size-3.5 text-k-loss" />
                <p className="text-sm font-medium">Stock bajo</p>
                <span className="text-xs text-muted-foreground">({stockBajo.length})</span>
              </div>
              <div className="rounded-2xl border border-k-loss/15 bg-k-loss-muted/15 overflow-hidden divide-y divide-border/40">
                {stockBajo.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                    <p className="text-sm truncate">{p.nombre}</p>
                    <span className="text-xs tabular-nums text-k-loss shrink-0 ml-3 font-medium">
                      {p.stock} / {p.stockMinimo}
                    </span>
                  </div>
                ))}
                {stockBajo.length > 5 && (
                  <div className="px-4 py-2 text-xs text-muted-foreground">
                    +{stockBajo.length - 5} más
                  </div>
                )}
              </div>
            </div>
          ) : hoy.cantidadVentas === 0 && topProveedores.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Sin ventas hoy"
              description="Empezá registrando la primera venta"
              action={
                <Link href="/vender">
                  <Button size="sm">Ir a vender</Button>
                </Link>
              }
            />
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  )
}
