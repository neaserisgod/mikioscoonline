"use client"

import { useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Loader2, Receipt, RotateCw } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatearARS } from "@/domain/dinero"
import { facturarVentaAction } from "@/app/actions/facturacion.actions"

interface MedioPago {
  id: string
  nombre: string
}

interface VentaFlags {
  sinLineas: boolean
  sinStock: boolean
  sinPago: boolean
  sinMovimientoCaja: boolean
}

interface VentaListado {
  id: string
  fecha: string
  usuario: string
  totalCentavos: number
  costoTotalCentavos: number
  recargoCentavos: number
  fiadoCentavos: number
  esConsumoInterno: boolean
  cliente: string | null
  medios: { nombre: string; montoCentavos: number }[]
  cantidadLineas: number
  comprobante: { estado: string; tipo: string; numero: number | null } | null
  flags: VentaFlags
  tieneProblema: boolean
}

interface RespuestaVentas {
  ventas: VentaListado[]
  total: number
  page: number
  pageSize: number
}

function getRangoDefault() {
  const hoy = new Date()
  const hasta = hoy.toISOString().slice(0, 10)
  const hace30 = new Date(hoy.getTime() - 29 * 24 * 60 * 60 * 1000)
  const desde = hace30.toISOString().slice(0, 10)
  return { desde, hasta }
}

const PAGE_SIZE = 50

const ETIQUETA_FLAG: Record<keyof VentaFlags, string> = {
  sinLineas: "Sin productos",
  sinStock: "Sin stock",
  sinPago: "Sin pago",
  sinMovimientoCaja: "Sin caja",
}

function fechaHoraLocal(iso: string) {
  return new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
}

const FACTURA_ESTADO_OPCIONES = [
  { value: "EMITIDO", label: "Facturadas" },
  { value: "ERROR", label: "Con error" },
  { value: "SIN_FACTURAR", label: "Sin facturar" },
]

export default function HistorialVentasClient() {
  const rangoDefault = getRangoDefault()
  const [desde, setDesde] = useState(rangoDefault.desde)
  const [hasta, setHasta] = useState(rangoDefault.hasta)
  const [medioPagoId, setMedioPagoId] = useState<string>("")
  const [facturaEstado, setFacturaEstado] = useState<string>("")
  const [soloProblemas, setSoloProblemas] = useState(false)
  const [page, setPage] = useState(1)
  const [facturandoId, setFacturandoId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: medios } = useQuery<MedioPago[]>({
    queryKey: ["medios-pago"],
    queryFn: () => fetch("/api/config/medios-pago").then((r) => r.json()),
    staleTime: 60_000,
  })

  const { data, isLoading } = useQuery<RespuestaVentas>({
    queryKey: ["historial-ventas", desde, hasta, medioPagoId, facturaEstado, soloProblemas, page],
    queryFn: () => {
      const params = new URLSearchParams({ desde, hasta, page: String(page), pageSize: String(PAGE_SIZE) })
      if (medioPagoId) params.set("medioPagoId", medioPagoId)
      if (facturaEstado) params.set("facturaEstado", facturaEstado)
      if (soloProblemas) params.set("soloProblemas", "1")
      return fetch(`/api/ventas?${params}`).then((r) => r.json())
    },
    placeholderData: (prev) => prev,
  })

  const facturar = useMutation({
    mutationFn: async (saleId: string) => {
      setFacturandoId(saleId)
      return facturarVentaAction(saleId)
    },
    onSuccess: (res) => {
      if (!res.ok) toast.error(res.error)
      queryClient.invalidateQueries({ queryKey: ["historial-ventas"] })
    },
    onSettled: () => setFacturandoId(null),
  })

  const ventas = data?.ventas ?? []
  const total = data?.total ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const totalVentas = ventas.reduce((s, v) => s + v.totalCentavos, 0)
  const conProblema = ventas.filter((v) => v.tieneProblema).length

  function actualizarFiltro(fn: () => void) {
    fn()
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-medium">Historial de ventas</h1>
        <p className="text-sm text-muted-foreground">Revisá todas las ventas registradas y detectá las que tienen algo faltante.</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Desde</label>
          <Input
            type="date"
            value={desde}
            onChange={(e) => actualizarFiltro(() => setDesde(e.target.value))}
            className="w-36"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Hasta</label>
          <Input
            type="date"
            value={hasta}
            onChange={(e) => actualizarFiltro(() => setHasta(e.target.value))}
            className="w-36"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Medio de pago</label>
          <Select
            value={medioPagoId || "__todos__"}
            onValueChange={(v) => actualizarFiltro(() => setMedioPagoId(v === "__todos__" ? "" : (v ?? "")))}
          >
            <SelectTrigger className="w-40"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todos</SelectItem>
              {medios?.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Factura</label>
          <Select
            value={facturaEstado || "__todas__"}
            onValueChange={(v) => actualizarFiltro(() => setFacturaEstado(v === "__todas__" ? "" : (v ?? "")))}
          >
            <SelectTrigger className="w-40"><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__todas__">Todas</SelectItem>
              {FACTURA_ESTADO_OPCIONES.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <Checkbox
            checked={soloProblemas}
            onCheckedChange={(v) => actualizarFiltro(() => setSoloProblemas(v === true))}
          />
          Solo con inconsistencias
        </label>
      </div>

      <div className="flex flex-wrap gap-4 rounded-2xl border bg-card p-4 text-sm">
        <div>
          <p className="text-muted-foreground">Ventas en esta página</p>
          <p className="font-heading text-lg font-medium">{ventas.length} de {total}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Total facturado (página)</p>
          <p className="font-heading text-lg font-medium">{formatearARS(totalVentas)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Con inconsistencia (página)</p>
          <p className={conProblema > 0 ? "font-heading text-lg font-medium text-destructive" : "font-heading text-lg font-medium"}>
            {conProblema}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : ventas.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No hay ventas en este rango"
          description="Probá ampliar el rango de fechas o sacar algún filtro."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Costo</TableHead>
                <TableHead>Medios de pago</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ventas.map((v) => (
                <TableRow key={v.id} className={v.tieneProblema ? "bg-destructive/5" : undefined}>
                  <TableCell className="text-muted-foreground">
                    <Link href={`/historial-ventas/${v.id}`} className="hover:underline">
                      {fechaHoraLocal(v.fecha)}
                    </Link>
                  </TableCell>
                  <TableCell>{v.usuario}</TableCell>
                  <TableCell>{formatearARS(v.totalCentavos)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatearARS(v.costoTotalCentavos)}</TableCell>
                  <TableCell>
                    {v.medios.length > 0 ? (
                      v.medios.map((m, i) => (
                        <span key={i} className="text-xs">
                          {m.nombre}
                          {i < v.medios.length - 1 ? " + " : ""}
                        </span>
                      ))
                    ) : v.fiadoCentavos > 0 ? (
                      <span className="text-xs text-muted-foreground">Fiado{v.cliente ? ` (${v.cliente})` : ""}</span>
                    ) : v.esConsumoInterno ? (
                      <span className="text-xs text-muted-foreground">Consumo interno</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{v.cantidadLineas}</TableCell>
                  <TableCell>
                    {v.comprobante?.estado === "EMITIDO" ? (
                      <Badge variant="outline">{v.comprobante.tipo.replace("FACTURA_", "")} Nº{v.comprobante.numero}</Badge>
                    ) : v.comprobante?.estado === "ERROR" ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        disabled={facturandoId === v.id}
                        onClick={() => facturar.mutate(v.id)}
                      >
                        {facturandoId === v.id ? <Loader2 className="size-3 animate-spin" /> : <RotateCw className="size-3" />}
                        Reintentar
                      </Button>
                    ) : v.esConsumoInterno ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        disabled={facturandoId === v.id}
                        onClick={() => facturar.mutate(v.id)}
                      >
                        {facturandoId === v.id ? <Loader2 className="size-3 animate-spin" /> : null}
                        Facturar
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    {v.tieneProblema ? (
                      <div className="flex flex-wrap gap-1">
                        {(Object.keys(v.flags) as (keyof VentaFlags)[])
                          .filter((k) => v.flags[k])
                          .map((k) => (
                            <Badge key={k} variant="destructive">
                              <AlertTriangle className="size-3" />
                              {ETIQUETA_FLAG[k]}
                            </Badge>
                          ))}
                      </div>
                    ) : (
                      <Badge variant="outline">OK</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">Página {page} de {totalPaginas}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPaginas} onClick={() => setPage((p) => p + 1)}>
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
