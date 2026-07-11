"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { TrendingUp } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { MarkupBadge } from "@/components/ui/markup-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { formatearARS } from "@/domain/dinero"
import { cn } from "@/lib/utils"

type Agrupador = "proveedor" | "categoria" | "heladera" | "caja"
type Periodo = "mes" | "historico"

interface FilaRentabilidad {
  id: string
  nombre: string
  unidadesVendidas: number
  ventasCentavos: number
  costoCentavos: number
  gananciaBrutaCentavos: number
  markupBp: number
  saldoReposicionCentavos?: number
}

const AGRUPADORES: { value: Agrupador; label: string }[] = [
  { value: "proveedor", label: "Por proveedor" },
  { value: "categoria", label: "Por categoría" },
  { value: "heladera", label: "Por heladera" },
  { value: "caja", label: "Por caja" },
]

function getMesRango(): { desde: string; hasta: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const desde = `${y}-${m}-01`
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()
  const hasta = `${y}-${m}-${String(lastDay).padStart(2, "0")}`
  return { desde, hasta }
}

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.02 } } },
  item: {
    hidden: { opacity: 0, x: -4 },
    show: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 300, damping: 30 } },
  },
}

const COLS = "grid-cols-[1fr_auto_auto_auto] lg:grid-cols-[1.4fr_0.7fr_0.9fr_1fr_1fr_auto]"

export default function RentabilidadClient() {
  const [agrupador, setAgrupador] = useState<Agrupador>("proveedor")
  const [periodo, setPeriodo] = useState<Periodo>("mes")
  const { desde, hasta } = getMesRango()

  const { data: filas, isLoading } = useQuery<FilaRentabilidad[]>({
    queryKey: ["rentabilidad", agrupador, periodo, desde, hasta],
    queryFn: () =>
      fetch(
        periodo === "mes"
          ? `/api/rentabilidad?por=${agrupador}&desde=${desde}&hasta=${hasta}`
          : `/api/rentabilidad?por=${agrupador}`
      ).then((r) => r.json()),
  })

  const totalVentas = filas?.reduce((s, f) => s + f.ventasCentavos, 0) ?? 0
  const totalGanancia = filas?.reduce((s, f) => s + f.gananciaBrutaCentavos, 0) ?? 0
  const totalUnidades = filas?.reduce((s, f) => s + f.unidadesVendidas, 0) ?? 0
  const totalCosto = filas?.reduce((s, f) => s + f.costoCentavos, 0) ?? 0
  const markupPromBp = totalCosto > 0 ? Math.round((totalGanancia / totalCosto) * 10_000) : 0
  const totalFondoReposicion =
    agrupador === "proveedor" ? filas?.reduce((s, f) => s + (f.saldoReposicionCentavos ?? 0), 0) ?? 0 : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-medium">Rentabilidad</h1>
          <p className="text-sm text-muted-foreground">
            {periodo === "mes" ? "Mes actual" : "Histórico completo"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1 rounded-full bg-muted p-1">
          {(["mes", "historico"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodo(p)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                periodo === p
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p === "mes" ? "Mes actual" : "Histórico"}
            </button>
          ))}
        </div>
      </div>

      {/* Totales — 2 cols mobile, 4 (o 5 en proveedor) cols desktop */}
      <div className={cn("grid grid-cols-2 gap-3", agrupador === "proveedor" ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">
            {periodo === "mes" ? "Ventas del mes" : "Ventas totales"}
          </p>
          <p className="text-xl font-semibold tabular-nums mt-1">{formatearARS(totalVentas)}</p>
        </div>
        <div className="rounded-2xl border border-k-gain/20 bg-k-gain-muted/20 p-4">
          <p className="text-xs text-muted-foreground">Ganancia bruta</p>
          <p className="text-xl font-semibold tabular-nums mt-1 text-k-gain">
            {formatearARS(totalGanancia)}
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Unidades</p>
          <p className="text-xl font-semibold tabular-nums mt-1">
            {totalUnidades.toLocaleString("es-AR")}
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Markup prom.</p>
          <p className="text-xl font-semibold tabular-nums mt-1">
            {totalCosto > 0 ? `${(markupPromBp / 100).toFixed(1)}%` : "—"}
          </p>
        </div>
        {totalFondoReposicion !== null && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-xs text-muted-foreground">Fondo de reposición</p>
            <p className={cn(
              "text-xl font-semibold tabular-nums mt-1",
              totalFondoReposicion < 0 ? "text-k-loss" : "text-amber-600 dark:text-amber-400"
            )}>
              {formatearARS(totalFondoReposicion)}
            </p>
          </div>
        )}
      </div>

      {/* Selector de agrupador */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {AGRUPADORES.map((a) => (
          <button
            key={a.value}
            type="button"
            onClick={() => setAgrupador(a.value)}
            className={cn(
              "shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors",
              agrupador === a.value
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-2xl" />
          ))}
        </div>
      ) : !filas || filas.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Sin datos para este período"
          description="Registrá ventas para ver la rentabilidad"
        />
      ) : (
        <motion.div
          className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40"
          variants={stagger.container}
          initial="hidden"
          animate="show"
        >
          {/* Header de tabla */}
          <div className={cn("grid gap-x-4 px-4 py-2.5 text-xs text-muted-foreground font-medium bg-muted/20", COLS)}>
            <span>Nombre</span>
            <span className="hidden lg:block text-right">Unidades</span>
            <span className="hidden lg:block text-right">Costo</span>
            <span className="text-right">Ventas</span>
            <span className="text-right">Ganancia</span>
            <span className="text-right">Markup</span>
          </div>

          {filas
            .sort((a, b) => b.gananciaBrutaCentavos - a.gananciaBrutaCentavos)
            .map((fila) => (
              <motion.div
                key={fila.id}
                variants={stagger.item}
                className={cn("grid gap-x-4 px-4 py-3 items-center", COLS)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{fila.nombre}</p>
                  <p className="text-xs text-muted-foreground lg:hidden">
                    {fila.unidadesVendidas} unidades
                  </p>
                  {agrupador === "proveedor" && (
                    <p className={cn(
                      "text-xs mt-0.5",
                      (fila.saldoReposicionCentavos ?? 0) < 0 ? "text-k-loss" : "text-amber-600 dark:text-amber-400"
                    )}>
                      Fondo repos.: {formatearARS(fila.saldoReposicionCentavos ?? 0)}
                    </p>
                  )}
                </div>
                <p className="hidden lg:block text-sm tabular-nums text-right text-muted-foreground">
                  {fila.unidadesVendidas.toLocaleString("es-AR")}
                </p>
                <p className="hidden lg:block text-sm tabular-nums text-right text-muted-foreground">
                  {formatearARS(fila.costoCentavos)}
                </p>
                <p className="text-sm tabular-nums text-right">
                  {formatearARS(fila.ventasCentavos)}
                </p>
                <p className={cn(
                  "text-sm font-semibold tabular-nums text-right",
                  fila.gananciaBrutaCentavos > 0 ? "text-k-gain" : "text-k-loss"
                )}>
                  {formatearARS(fila.gananciaBrutaCentavos)}
                </p>
                <MarkupBadge markupBp={fila.markupBp} />
              </motion.div>
            ))}
        </motion.div>
      )}
    </div>
  )
}
