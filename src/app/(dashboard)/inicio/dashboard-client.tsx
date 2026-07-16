"use client"

import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { stagger } from "@/lib/motion"
import { ShoppingCart, AlertTriangle, TrendingUp, Zap, ArrowDownLeft, ArrowUpRight, Loader2, FileText, ClipboardCheck, ChevronDown } from "lucide-react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { formatearARS } from "@/domain/dinero"
import { cn } from "@/lib/utils"
import { cerrarCajaAction, registrarMovimientoAction, registrarArqueoParcialAction } from "@/app/actions/cajaSesion.actions"
import { retirarGananciaAction } from "@/app/actions/config.actions"
import { AbrirCajaSheet } from "@/components/pos/abrir-caja-sheet"

interface ResumenHoy {
  ventasCentavos: number
  gananciaBrutaCentavos: number
  comisionesTotalesCentavos: number
  cantidadVentas: number
  gananciaNeta: number
}

interface ResumenMes {
  mesAnio: string
  gananciaNetaCentavos: number
  pctAvance: number
  faltanteCentavos: number
  cubierto: boolean
  gastosFijosCentavos: number
  gananciaBrutaCentavos: number
  comisionesTotalesCentavos: number
}

interface Equilibrio {
  gastosFijosCentavos: number
  gananciaBrutaCentavos: number
  comisionesTotalesCentavos: number
  gananciaNetaCentavos: number
  pctAvance: number
  faltanteCentavos: number
  cubierto: boolean
}

interface SaldoManual {
  montoCentavos: number
  actualizadoEn: string | null
}

interface CajaSaldo extends SaldoManual {
  id: string
  nombre: string
}

interface Reparto {
  disponibleRealCentavos: number
  gastosFijosPendientesCentavos: number
  gastosFijosCubiertos: boolean
  gastosFijosFaltanteCentavos: number
  reservaReposicionCentavos: number
  reposicionCubierta: boolean
  reposicionFaltanteCentavos: number
  proveedoresPiso: { id: string; nombre: string; pisoReposicionCentavos: number; saldoReposicionCentavos: number }[]
  gananciaDisponibleCentavos: number
}
interface ValorInventario {
  valorCostoCentavos: number
  valorVentaCentavos: number
}
interface ResumenData {
  hoy: ResumenHoy | null // null para VENDEDOR — no ve cifras de ganancia
  mes: ResumenMes | null
  cajas: CajaSaldo[] | null
  disponibleRealCentavos: number | null
  equilibrio: Equilibrio | null
  reparto: Reparto | null
  valorInventario: ValorInventario | null
  stockBajo: { id: string; nombre: string; stock: number; stockMinimo: number }[]
  serie: { fecha: string; netoCentavos: number }[] | null
}

/** Sparkline minimalista para el hero: polyline normalizada, sin ejes ni grilla. */
function Sparkline({ valores, className }: { valores: number[]; className?: string }) {
  if (valores.length < 2) return null
  const w = 100
  const h = 28
  const min = Math.min(...valores, 0)
  const max = Math.max(...valores, 0)
  const rango = max - min || 1
  const pts = valores.map((v, i) => {
    const x = (i / (valores.length - 1)) * w
    const y = h - ((v - min) / rango) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function RepartoFila({
  label, cubierto, monto, faltaLabel, okLabel,
}: {
  label: string; cubierto: boolean; monto: number; faltaLabel: string; okLabel: string
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium tabular-nums", cubierto ? "text-k-gain" : "text-k-loss")}>
        {cubierto ? okLabel : `${faltaLabel} ${formatearARS(monto)}`}
      </span>
    </div>
  )
}

function nombreMes(mesAnio: string): string {
  const [y, m] = mesAnio.split("-").map(Number)
  const nombre = new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long" })
  return nombre.charAt(0).toUpperCase() + nombre.slice(1)
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
  // Incluye ventas digitales — ver el comentario de calcEfectivoEnCaja: una caja
  // 100% no-efectivo (ej. "Ventas QR/Posnet") si no, siempre quedaría en $0.
  const efectivoEnCaja = fondoInicialCentavos + ventasEfectivo + ventasDigital + ingresos - egresos
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
  manejaEfectivo: boolean
  sesiones: CajaSesionPanel[]
  /** Lo contado al cerrar la última sesión — sugerido como fondo inicial al reabrir. */
  ultimoCierreCentavos: number | null
}

// Total atribuido a la caja (fondo + ventas + ingresos − egresos), para el
// panel de un vistazo y el prellenado del cierre. A diferencia de
// `calcularEquilibrio`/`cajaSesionService.cerrarCaja` (que SOLO cuentan ventas
// en efectivo — correcto ahí, porque comparan contra billetes contados a
// mano), acá se suman también las ventas digitales: cajas 100% no-efectivo
// (ej. "Ventas QR/Posnet") nunca tendrían nada de efectivo y el total mostrado
// quedaría siempre en $0 pese a tener ventas reales.
function calcEfectivoEnCaja(s: CajaSesionPanel): number {
  let total = s.fondoInicialCentavos
  for (const m of s.movimientos) {
    if (m.tipo === "INGRESO") total += m.montoCentavos
    else if (m.tipo === "EGRESO") total -= m.montoCentavos
    else if (m.tipo === "VENTA") total += m.montoCentavos
  }
  return total
}

function horaCorta(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
}

/** Sesiones abiertas hace demasiado (>24hs) casi siempre significa que se
 * olvidaron de cerrar la caja el día anterior — hoy nadie se entera hasta que
 * alguien mira el panel a mano, ver CajasPanel más abajo. */
const HORAS_SESION_SOSPECHOSA = 24

function horasAbierta(fechaApertura: string): number {
  return (Date.now() - new Date(fechaApertura).getTime()) / (60 * 60_000)
}

type PanelMode = "abrir" | "cerrar" | "movimiento" | "detalle" | "arqueo"

function CajasPanel() {
  const qc = useQueryClient()
  const { data: cajas, isLoading, dataUpdatedAt } = useQuery<CajaPanelItem[]>({
    queryKey: ["cajas-panel"],
    queryFn: () => fetch("/api/cajas").then((r) => r.json()),
    staleTime: 5 * 60_000,
  })

  const [mode, setMode] = useState<PanelMode | null>(null)
  const [cajaId, setCajaId] = useState<string | null>(null)
  const [sesionId, setSesionId] = useState<string | null>(null)
  const [cajaNombre, setCajaNombre] = useState("")
  const [expectedCash, setExpectedCash] = useState(0)
  const [sesionData, setSesionData] = useState<CajaSesionPanel | null>(null)
  const [fondoSugerido, setFondoSugerido] = useState<number | null>(null)
  const [manejaEfectivo, setManejaEfectivo] = useState(true)

  function invalidar() { qc.invalidateQueries({ queryKey: ["cajas-panel"] }) }

  function openAbrir(c: CajaPanelItem) {
    setCajaId(c.id); setCajaNombre(c.nombre); setFondoSugerido(c.ultimoCierreCentavos); setManejaEfectivo(c.manejaEfectivo); setMode("abrir")
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
  function openArqueo(c: CajaPanelItem, s: CajaSesionPanel) {
    setSesionId(s.id); setCajaNombre(c.nombre); setExpectedCash(calcEfectivoEnCaja(s)); setMode("arqueo")
  }

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : null

  return (
    <>
      <div className="rounded-2xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] overflow-hidden">
        <div className="px-5 pt-4 pb-3 flex items-center justify-between">
          <p className="text-[15px] font-semibold tracking-tight">Cajas</p>
          {lastUpdate && (
            <p className="text-[11px] text-muted-foreground">{lastUpdate}</p>
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
              const sospechosa = abierta && horasAbierta(sesion.fechaApertura) > HORAS_SESION_SOSPECHOSA

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
                      {sospechosa && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          title="Lleva más de 24hs abierta — ¿se olvidaron de cerrarla?"
                        >
                          ¿Olvidada?
                        </span>
                      )}
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
                      <p className={cn("text-[15px] font-semibold tabular-nums tracking-tight", enCaja >= 0 ? "text-k-gain" : "text-k-loss")}>
                        {formatearARS(enCaja)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">en caja</p>
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
                          variant="ghost" size="icon-sm"
                          title="Hacer arqueo de control (no cierra la caja)"
                          onClick={() => openArqueo(caja, sesion)}
                        >
                          <ClipboardCheck className="size-3.5" />
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
              fondoSugerido={fondoSugerido}
              manejaEfectivo={manejaEfectivo}
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
          {mode === "arqueo" && sesionId && (
            <ArqueoParcialManualSheet
              cajaNombre={cajaNombre}
              sesionId={sesionId}
              efectivoEsperado={expectedCash}
              onSuccess={() => { setMode(null); invalidar() }}
            />
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
            type="number" step="0.01" min="0" inputMode="decimal" autoFocus
            {...register("pesos", { valueAsNumber: true })}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
            type="number" step="0.01" min="0" inputMode="decimal" autoFocus
            {...register("pesos", { valueAsNumber: true })}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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

/** Arqueo de control disparado a mano (a diferencia de ArqueoParcialGate, que
 * solo aparece cuando se venció un horario de control) — no cierra la caja,
 * solo deja registro de esperado/contado/diferencia en este momento. */
function ArqueoParcialManualSheet({ cajaNombre, sesionId, efectivoEsperado, onSuccess }: {
  cajaNombre: string; sesionId: string; efectivoEsperado: number; onSuccess: () => void
}) {
  const [contado, setContado] = useState("")
  const [nota, setNota] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const montoCentavos = Math.round(parseFloat(contado) * 100)
    if (!Number.isFinite(montoCentavos) || montoCentavos < 0) { toast.error("Ingresá un monto válido"); return }
    setIsSubmitting(true)
    try {
      await registrarArqueoParcialAction(sesionId, { efectivoContadoCentavos: montoCentavos, nota: nota || undefined })
      toast.success("Arqueo registrado")
      onSuccess()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setIsSubmitting(false) }
  }

  return (
    <>
      <SheetHeader><SheetTitle>Arqueo de control · {cajaNombre}</SheetTitle></SheetHeader>
      <p className="mt-2 text-xs text-muted-foreground">
        Un conteo de control, no cierra la caja — sigue abierta con normalidad después de esto.
      </p>
      <div className="mt-4 rounded-xl border border-border/60 bg-card px-4 py-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Esperado ahora</p>
        <p className="text-lg font-semibold tabular-nums">{formatearARS(efectivoEsperado)}</p>
      </div>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label>Contaste ($)</Label>
          <input
            type="number" step="0.01" min="0" autoFocus
            value={contado} onChange={(e) => setContado(e.target.value)}
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Nota (opcional)</Label>
          <input
            type="text" value={nota} onChange={(e) => setNota(e.target.value)}
            placeholder="Explicar diferencia, si hay"
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Registrar arqueo"}
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
          <span className="text-sm font-medium">Total en caja</span>
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

// ─── Inicio para VENDEDOR (sin cifras de ganancia) ────────────────────────────

function InicioVendedor({ stockBajo }: { stockBajo: { id: string; nombre: string; stock: number; stockMinimo: number }[] }) {
  return (
    <motion.div className="space-y-5" variants={stagger.container} initial="hidden" animate="show">
      <motion.div variants={stagger.item}>
        <CajasPanel />
      </motion.div>

      <motion.div variants={stagger.item}>
        <Link href="/vender" className="block">
          <div className="rounded-2xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] hover:bg-muted/30 transition-colors p-5 flex items-center gap-3">
            <div className="rounded-xl bg-foreground/8 p-2.5 shrink-0">
              <Zap className="size-4 text-foreground/70" />
            </div>
            <div>
              <p className="text-sm font-medium">Vender</p>
              <p className="text-xs text-muted-foreground">Nueva venta</p>
            </div>
          </div>
        </Link>
      </motion.div>

      {stockBajo.length > 0 && (
        <motion.div variants={stagger.item} className="space-y-2.5">
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
        </motion.div>
      )}
    </motion.div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function getToday() {
  // Fecha LOCAL, no UTC — toISOString() corre el día para atrás en husos
  // horarios negativos (ej. Argentina) cerca de la medianoche.
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function DashboardClient() {
  const qc = useQueryClient()
  const [retirandoOpen, setRetirandoOpen] = useState(false)
  // Saludo + fecha por hora local. Se calculan en el cliente (useEffect) para no
  // romper la hidratación: el server no sabe la hora/zona del navegador.
  const [saludo, setSaludo] = useState<{ hola: string; fecha: string } | null>(null)
  useEffect(() => {
    const now = new Date()
    const h = now.getHours()
    const hola = h < 12 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches"
    const fecha = now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicialización única en mount, no re-render en loop
    setSaludo({ hola, fecha: fecha.charAt(0).toUpperCase() + fecha.slice(1) })
  }, [])
  const { data, isLoading } = useQuery<ResumenData>({
    queryKey: ["resumen"],
    queryFn: () => fetch("/api/resumen").then((r) => r.json()),
  })

  const today = getToday()
  const { data: proveedoresHoy } = useQuery<FilaProveedor[]>({
    queryKey: ["rentabilidad-hoy", today],
    queryFn: () =>
      fetch(`/api/rentabilidad?por=proveedor&desde=${today}&hasta=${today}`).then((r) => r.json()),
    enabled: !!data?.hoy, // VENDEDOR no tiene acceso a /api/rentabilidad — ni intentarlo
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

  if (!data.hoy || !data.mes || !data.cajas || !data.equilibrio || !data.reparto || !data.valorInventario) {
    return <InicioVendedor stockBajo={data.stockBajo ?? []} />
  }

  const { hoy, mes, reparto, valorInventario } = data
  const serie = (data.serie ?? []).map((d) => d.netoCentavos)
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

      {/* ── Saludo ──────────────────────────────────────────────────────────────── */}
      <motion.div variants={stagger.item} className="flex items-baseline justify-between gap-4">
        <div className="min-h-[3.25rem]">
          {saludo && (
            <>
              <p className="text-[13px] text-muted-foreground">{saludo.fecha}</p>
              <h1 className="text-2xl font-semibold tracking-tight">{saludo.hola}</h1>
            </>
          )}
        </div>
      </motion.div>

      {/* ── Hero oscuro: ganancia neta del día — fila única para bajar altura ───── */}
      <motion.div variants={stagger.item}>
        <Link
          href="/clientes?tab=rentabilidad&periodo=hoy&agrupador=proveedor"
          className="group block rounded-3xl bg-[#1c1c1e] text-white p-6 sm:p-7 transition-colors hover:bg-[#252527]"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="shrink-0">
              <p className="flex items-center gap-1.5 text-sm text-white/55 mb-1.5">
                Ganancia neta de hoy
                <ArrowUpRight className="size-3.5 text-white/30 group-hover:text-white/70 transition-colors" />
              </p>
              <p className={cn(
                "text-5xl lg:text-6xl leading-none font-semibold tabular-nums tracking-[-0.035em]",
                hoy.gananciaNeta < 0 ? "text-[#ff6b6b]" : "text-white"
              )}>
                {formatearARS(hoy.gananciaNeta)}
              </p>
            </div>
            <div className="flex items-center gap-8 lg:gap-10">
              {serie.length >= 2 && serie.some((v) => v !== 0) && (
                <div className="hidden md:block w-40 lg:w-52">
                  <p className="text-[11px] text-white/40 mb-1.5">Últimos 14 días</p>
                  <Sparkline valores={serie} className="h-10 w-full text-[#30d158]" />
                </div>
              )}
              <div className="flex items-center gap-8">
                <div>
                  <p className="text-xs text-white/50 mb-1">Ventas</p>
                  <p className="text-lg font-semibold tabular-nums tracking-tight">{formatearARS(hoy.ventasCentavos)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/50 mb-1">Tickets</p>
                  <p className="text-lg font-semibold tabular-nums tracking-tight">{hoy.cantidadVentas}</p>
                </div>
                <div>
                  <p className="text-xs text-white/50 mb-1">Margen</p>
                  <p className="text-lg font-semibold tabular-nums tracking-tight">{margenPct}%</p>
                </div>
              </div>
            </div>
          </div>
        </Link>
      </motion.div>

      {/* ── Objetivo del mes (anillo) + ganancia retirable ──────────────────────── */}
      <motion.div variants={stagger.item} className="grid sm:grid-cols-2 gap-4">
        <Link href="/clientes?tab=rentabilidad" className="group rounded-3xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] p-6 flex items-center gap-5 transition-colors hover:bg-muted/30">
          <div className="relative size-[104px] shrink-0">
            <svg viewBox="0 0 120 120" className="size-[104px] -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" className="stroke-foreground/[0.07]" strokeWidth="13" />
              <circle
                cx="60" cy="60" r="52" fill="none"
                className={cn(mes.cubierto ? "stroke-k-gain" : "stroke-primary")}
                strokeWidth="13" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 52}
                strokeDashoffset={2 * Math.PI * 52 * (1 - Math.max(0, Math.min(100, mes.pctAvance)) / 100)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold tabular-nums tracking-tight">{mes.pctAvance}%</span>
              <span className="text-[11px] text-muted-foreground">del mes</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight mb-1">
              Objetivo de {nombreMes(mes.mesAnio)}
              <ArrowUpRight className="size-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
            </p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              {mes.cubierto
                ? "Ya cubrís los gastos fijos del mes que viene."
                : <>Falta <span className="text-foreground font-medium tabular-nums">{formatearARS(mes.faltanteCentavos)}</span> para cubrir los gastos del mes que viene.</>}
            </p>
          </div>
        </Link>

        <div className="rounded-3xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] p-6 flex flex-col">
          <p className="text-[13px] text-muted-foreground mb-1">Es tuyo, te lo podés llevar</p>
          <p className={cn(
            "text-3xl font-semibold tabular-nums tracking-[-0.02em]",
            reparto.gananciaDisponibleCentavos > 0 ? "text-k-gain" : "text-muted-foreground"
          )}>
            {formatearARS(reparto.gananciaDisponibleCentavos)}
          </p>
          <div className="mt-auto pt-4">
            <Button
              className="w-full"
              disabled={reparto.gananciaDisponibleCentavos <= 0}
              onClick={() => setRetirandoOpen(true)}
            >
              Retirar ganancia
            </Button>
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

          {/* Una sola cascada, de arriba a abajo, sin repetir números: efectivo
              disponible (saldo en vivo de cada caja abierta) → gastos fijos del
              mes (ya neteados de lo pagado) → piso de reinversión de cada
              proveedor (colchón fijo, no se resetea) → lo que sobra es ganancia
              limpia, retirable. Al final, la mercadería en estantería (a costo)
              se suma aparte para el patrimonio total — es plata, pero no es
              líquida. Antes esto eran 3 cards separadas repitiendo "disponible
              real" cada una — se fusionó para bajar el ruido visual (feedback
              del dueño 2026-07-10: "no lo entiendo ni yo que tuve la idea").
              Ver resumenService.reparto / equilibrioReal / productoService.valorInventario. */}
          <div className="rounded-2xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Link href="/clientes?tab=rentabilidad" className="group flex items-center gap-1.5 text-sm font-medium hover:text-foreground/70 transition-colors">
                ¿Cómo estamos?
                <ArrowUpRight className="size-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
              </Link>
              <span className={cn(
                "shrink-0 text-xs font-medium px-2 py-0.5 rounded-full",
                reparto.gastosFijosCubiertos ? "bg-k-gain-muted text-k-gain" : "bg-muted text-muted-foreground"
              )}>
                {reparto.gastosFijosCubiertos ? "Vas bien" : "Ojo"}
              </span>
            </div>

            {/* Foco único: la plata líquida que hay ahora. El resto del desglose
                (obligaciones + patrimonio) queda detrás de "Ver desglose" para
                bajar la carga cognitiva — un solo número manda la sección. */}
            <div>
              <p className="text-xs text-muted-foreground">Plata que tenés ahora, en la mano</p>
              <p className="text-[2rem] leading-none font-semibold tabular-nums tracking-[-0.02em] mt-1">
                {formatearARS(reparto.disponibleRealCentavos)}
              </p>
            </div>

            <details className="group/desglose">
              <summary className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer list-none select-none hover:text-foreground transition-colors [&::-webkit-details-marker]:hidden">
                <ChevronDown className="size-3.5 transition-transform group-open/desglose:rotate-180" />
                <span>Ver desglose</span>
              </summary>
              <div className="mt-3 space-y-2">
                <RepartoFila
                  label={`Para pagar este mes (alquiler, luz, etc.)`}
                  cubierto={reparto.gastosFijosCubiertos}
                  monto={reparto.gastosFijosCubiertos ? reparto.gastosFijosPendientesCentavos : reparto.gastosFijosFaltanteCentavos}
                  faltaLabel="Todavía falta"
                  okLabel="Ya lo tenés cubierto"
                />
                {reparto.reservaReposicionCentavos > 0 && (
                  <RepartoFila
                    label="Para reponer mercadería"
                    cubierto={reparto.reposicionCubierta}
                    monto={reparto.reposicionCubierta ? reparto.reservaReposicionCentavos : reparto.reposicionFaltanteCentavos}
                    faltaLabel="Todavía falta"
                    okLabel="Ya tenés lo necesario"
                  />
                )}
                {reparto.reservaReposicionCentavos > 0 && !reparto.reposicionCubierta && (
                  <p className="text-[11px] text-muted-foreground">
                    Te falta juntar para reponer: {reparto.proveedoresPiso.filter((p) => p.pisoReposicionCentavos > 0).map((p) => p.nombre).join(", ")}.
                  </p>
                )}
                <div className="border-t border-border/60 pt-2.5 mt-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">+ Lo que tenés en la estantería</span>
                  <span className="font-medium tabular-nums">{formatearARS(valorInventario.valorCostoCentavos)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">= Todo lo que tiene tu negocio</span>
                  <span className="font-semibold tabular-nums">
                    {formatearARS(reparto.disponibleRealCentavos + valorInventario.valorCostoCentavos)}
                  </span>
                </div>
              </div>
            </details>
          </div>


          {/* Métricas bruta + comisiones */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/clientes?tab=rentabilidad&periodo=hoy" className="group rounded-2xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] p-4 transition-colors hover:bg-muted/30">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                Ganancia bruta hoy
                <ArrowUpRight className="size-3 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
              </p>
              <p className={cn(
                "text-lg font-semibold tabular-nums mt-1",
                hoy.gananciaBrutaCentavos > 0 ? "text-k-gain" : ""
              )}>
                {formatearARS(hoy.gananciaBrutaCentavos)}
              </p>
            </Link>
            <Link href="/clientes?tab=rentabilidad&periodo=hoy" className="group rounded-2xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] p-4 transition-colors hover:bg-muted/30">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                Comisiones hoy
                <ArrowUpRight className="size-3 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
              </p>
              <p className={cn(
                "text-lg font-semibold tabular-nums mt-1",
                hoy.comisionesTotalesCentavos > 0 ? "text-k-loss" : ""
              )}>
                {formatearARS(hoy.comisionesTotalesCentavos)}
              </p>
            </Link>
          </div>

        </div>

        {/* Columna derecha */}
        <div className="space-y-4">

          {/* Dónde ganás hoy — el header linkea a Rentabilidad con período "Hoy"
              ya seleccionado, para ver el desglose completo (unidades, costo,
              markup, u otros agrupadores) sin reimplementar esa tabla acá. */}
          <div className="rounded-2xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] overflow-hidden">
            <Link
              href="/clientes?tab=rentabilidad&periodo=hoy&agrupador=proveedor"
              className="flex items-center justify-between px-4 pt-4 pb-2.5 border-b border-border/40 hover:bg-muted/30 transition-colors"
            >
              <div>
                <p className="text-sm font-medium">Dónde ganás hoy</p>
                <p className="text-xs text-muted-foreground">Por proveedor · ganancia bruta</p>
              </div>
              <TrendingUp className="size-3.5 text-muted-foreground shrink-0" />
            </Link>
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
            <Link href="/productos" className="group block rounded-2xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] overflow-hidden transition-colors hover:bg-muted/20">
              <div className="flex items-center gap-2 px-4 pt-4 pb-2.5 border-b border-border/40">
                <AlertTriangle className="size-3.5 text-k-loss shrink-0" />
                <p className="text-sm font-medium">Stock bajo</p>
                <span className="text-xs text-muted-foreground">({stockBajo.length})</span>
                <ArrowUpRight className="size-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors ml-auto shrink-0" />
              </div>
              <div className="divide-y divide-border/40">
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
            </Link>
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

      <Sheet open={retirandoOpen} onOpenChange={setRetirandoOpen}>
        <SheetContent>
          <RetirarGananciaForm
            gananciaDisponibleCentavos={reparto.gananciaDisponibleCentavos}
            cajas={data.cajas ?? []}
            onSuccess={() => {
              setRetirandoOpen(false)
              qc.invalidateQueries({ queryKey: ["resumen"] })
              qc.invalidateQueries({ queryKey: ["cajas-panel"] })
            }}
          />
        </SheetContent>
      </Sheet>
    </motion.div>
  )
}

function RetirarGananciaForm({
  gananciaDisponibleCentavos, cajas, onSuccess,
}: {
  gananciaDisponibleCentavos: number
  cajas: CajaSaldo[]
  onSuccess: () => void
}) {
  const [monto, setMonto] = useState(String(gananciaDisponibleCentavos / 100))
  const [cajaId, setCajaId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const montoCentavos = Math.round(parseFloat(monto) * 100)
    if (!montoCentavos || montoCentavos <= 0) { toast.error("Ingresá un monto válido"); return }
    if (!cajaId) { toast.error("Elegí de qué caja retirás"); return }
    setIsSubmitting(true)
    try {
      await retirarGananciaAction(montoCentavos, cajaId)
      toast.success("Retiro registrado")
      onSuccess()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setIsSubmitting(false) }
  }

  return (
    <>
      <SheetHeader><SheetTitle>Llevarte tu plata</SheetTitle></SheetHeader>
      <div className="mt-4 rounded-xl border border-border/60 bg-card px-4 py-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Podés llevarte hasta</p>
        <p className="text-lg font-semibold tabular-nums text-k-gain">{formatearARS(gananciaDisponibleCentavos)}</p>
      </div>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label>¿Cuánto te llevás? ($)</Label>
          <input
            type="number" step="0.01" min="0" inputMode="decimal" autoFocus
            value={monto} onChange={(e) => setMonto(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <Label>¿De qué caja la sacás?</Label>
          <Select value={cajaId} onValueChange={(v) => setCajaId(v ?? "")}>
            <SelectTrigger><SelectValue placeholder="Elegí una caja" /></SelectTrigger>
            <SelectContent>
              {cajas.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Listo, ya la retiré"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Esa caja tiene que estar abierta. Nunca te va a dejar llevar más de lo que es realmente tuyo.
        </p>
      </form>
    </>
  )
}
