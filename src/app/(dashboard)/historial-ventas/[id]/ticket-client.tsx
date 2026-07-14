"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Printer, RotateCw, AlertTriangle, CheckCircle2, Clock } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { formatearARS } from "@/domain/dinero"
import { facturarVentaAction } from "@/app/actions/facturacion.actions"
import type { ventaService } from "@/services/venta.service"

type Venta = NonNullable<Awaited<ReturnType<typeof ventaService.obtener>>>

const NOMBRE_TIPO: Record<string, string> = {
  FACTURA_A: "Factura A",
  FACTURA_B: "Factura B",
  FACTURA_C: "Factura C",
}

export default function TicketClient({ venta, qrDataUrl }: { venta: Venta; qrDataUrl: string | null }) {
  const router = useRouter()
  const [reintentando, setReintentando] = useState(false)
  const comprobante = venta.comprobante

  async function reintentar() {
    setReintentando(true)
    try {
      const res = await facturarVentaAction(venta.id)
      if (!res.ok) toast.error(res.error)
      router.refresh()
    } finally {
      setReintentando(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="font-heading text-xl font-medium">Ticket</h1>
        <div className="flex gap-2">
          {comprobante?.estado === "ERROR" && (
            <Button variant="outline" size="sm" onClick={reintentar} disabled={reintentando}>
              <RotateCw className={reintentando ? "size-4 animate-spin" : "size-4"} /> Reintentar factura
            </Button>
          )}
          {!comprobante && !venta.esConsumoInterno && (
            <Button variant="outline" size="sm" onClick={reintentar} disabled={reintentando}>
              <RotateCw className={reintentando ? "size-4 animate-spin" : "size-4"} /> Facturar
            </Button>
          )}
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimir
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border bg-card p-5 text-sm">
        <div>
          <p className="font-heading text-lg font-medium">{venta.organization.nombre}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(venta.fecha).toLocaleString("es-AR")} · Vendió {venta.user.nombre || venta.user.email}
          </p>
          {venta.customer && <p className="text-xs text-muted-foreground">Cliente: {venta.customer.nombre}</p>}
        </div>

        <div className="divide-y divide-border/60 border-y border-border/60">
          {venta.lines.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 py-1.5">
              <span className="min-w-0 truncate">
                {l.product.esPesable ? `${((l.gramos ?? 0) / 1000).toFixed(3)}kg` : `${l.cantidad}x`} {l.product.nombre}
              </span>
              <span className="shrink-0 tabular-nums">{formatearARS(l.precioUnitarioCentavos * (l.product.esPesable ? 1 : l.cantidad))}</span>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          {venta.descuentoCentavos > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Descuento</span>
              <span>−{formatearARS(venta.descuentoCentavos)}</span>
            </div>
          )}
          {venta.recargoCentavos > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Recargo</span>
              <span>+{formatearARS(venta.recargoCentavos)}</span>
            </div>
          )}
          <div className="flex justify-between font-medium">
            <span>Total</span>
            <span className="tabular-nums">{formatearARS(venta.totalCentavos + venta.recargoCentavos)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {venta.payments.map((p) => p.paymentMethod.nombre).join(" + ") || (venta.fiadoCentavos > 0 ? "Fiado" : "—")}
          </p>
        </div>

        <div className="border-t border-dashed border-border/60 pt-3">
          {!comprobante ? (
            <p className="text-xs text-muted-foreground">
              {venta.esConsumoInterno ? "Consumo interno — no se factura." : "Esta venta no se facturó. Podés hacerlo manualmente arriba."}
            </p>
          ) : comprobante.estado === "EMITIDO" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-k-gain">
                <CheckCircle2 className="size-4" />
                <span className="font-medium">{NOMBRE_TIPO[comprobante.tipo] ?? comprobante.tipo} — Pto. Vta. {comprobante.puntoVenta}, Nº {comprobante.numero}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                CAE {comprobante.cae} · vence {comprobante.caeFechaVencimiento && new Date(comprobante.caeFechaVencimiento).toLocaleDateString("es-AR")}
              </p>
              {qrDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="Código QR de AFIP" className="size-32" />
              )}
            </div>
          ) : comprobante.estado === "ERROR" ? (
            <div className="flex items-start gap-1.5 text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">No se pudo facturar</p>
                <p className="text-xs">{comprobante.error}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-4" />
              <span>Facturación pendiente</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
