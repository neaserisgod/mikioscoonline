"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { formatARS } from "@/lib/formatters"
import { Download, TrendingUp, TrendingDown, Package, AlertTriangle } from "lucide-react"

interface ResumenHoy {
  ventasCentavos: number
  costoTotalCentavos: number
  gananciaBrutaCentavos: number
  cantidadVentas: number
  markupBp: number
  comisionesTotalesCentavos: number
  gananciaNeta: number
}

interface ResumenMes {
  mesAnio: string
  ventasCentavos: number
  gananciaBrutaCentavos: number
  comisionesTotalesCentavos: number
  gastosFijosCentavos: number
  gananciaNetaCentavos: number
  pctAvance: number
  faltanteCentavos: number
  cubierto: boolean
}

interface StockBajoItem {
  id: string
  sku: string
  nombre: string
  stock: number
  stockMinimo: number
}

interface ResumenData {
  hoy: ResumenHoy
  mes: ResumenMes
  stockBajo: StockBajoItem[]
}

export default function ReportesPage() {
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")

  const { data, isLoading } = useQuery<ResumenData>({
    queryKey: ["resumen"],
    queryFn: () => fetch("/api/resumen").then((r) => r.json()),
  })

  const exportParams = new URLSearchParams()
  if (desde) exportParams.set("desde", desde)
  if (hasta) exportParams.set("hasta", hasta)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reportes</h1>

      {isLoading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <>
          {/* KPIs de hoy */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Hoy</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                title="Ventas del día"
                value={formatARS(data.hoy.ventasCentavos)}
                sub={`${data.hoy.cantidadVentas} ventas`}
                icon={TrendingUp}
                variant="success"
              />
              <KpiCard
                title="Ganancia bruta"
                value={formatARS(data.hoy.gananciaBrutaCentavos)}
                sub={`Markup ${(data.hoy.markupBp / 100).toFixed(1)}%`}
                icon={TrendingUp}
                variant="success"
              />
              <KpiCard
                title="Comisiones"
                value={formatARS(data.hoy.comisionesTotalesCentavos)}
                icon={TrendingDown}
              />
              <KpiCard
                title="Ganancia neta"
                value={formatARS(data.hoy.gananciaNeta)}
                icon={TrendingUp}
                variant={data.hoy.gananciaNeta >= 0 ? "success" : "warning"}
              />
            </div>
          </div>

          {/* KPIs del mes */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              {data.mes.mesAnio} (mes actual)
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                title="Ventas del mes"
                value={formatARS(data.mes.ventasCentavos)}
                icon={TrendingUp}
                variant="success"
              />
              <KpiCard
                title="Gastos fijos"
                value={formatARS(data.mes.gastosFijosCentavos)}
                icon={TrendingDown}
                variant={data.mes.cubierto ? "default" : "warning"}
              />
              <KpiCard
                title="Ganancia neta mes"
                value={formatARS(data.mes.gananciaNetaCentavos)}
                sub={data.mes.cubierto ? "Gastos cubiertos" : `Falta ${formatARS(data.mes.faltanteCentavos)}`}
                icon={TrendingUp}
                variant={data.mes.cubierto ? "success" : "warning"}
              />
              <KpiCard
                title="Stock bajo"
                value={String(data.stockBajo.length)}
                sub={data.stockBajo.length > 0 ? data.stockBajo.map((p) => p.nombre).slice(0, 2).join(", ") : "Todo en orden"}
                icon={AlertTriangle}
                variant={data.stockBajo.length > 0 ? "warning" : "default"}
              />
            </div>
          </div>

          {/* Stock bajo */}
          {data.stockBajo.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="size-4 text-amber-500" />
                  Productos con stock bajo ({data.stockBajo.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border/40">
                  {data.stockBajo.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <span className="font-medium">{p.nombre}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{p.sku}</span>
                      </div>
                      <span className="text-amber-600 font-medium tabular-nums">
                        {p.stock} / {p.stockMinimo} mín.
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Exportaciones */}
      <Card>
        <CardHeader><CardTitle className="text-base">Exportar datos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Desde</p>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Hasta</p>
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-40" />
            </div>
          </div>
          <div className="flex gap-3">
            <a href={`/api/reportes/exportar/ventas?${exportParams}`}>
              <Button variant="outline">
                <Download className="mr-2 size-4" />
                Exportar ventas (CSV)
              </Button>
            </a>
            <a href="/api/reportes/exportar/stock">
              <Button variant="outline">
                <Download className="mr-2 size-4" />
                Exportar stock (CSV)
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
