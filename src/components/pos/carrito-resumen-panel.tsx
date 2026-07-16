"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, CheckCircle2, AlertTriangle, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { formatearARS } from "@/domain/dinero"
import { cn } from "@/lib/utils"
import { crearClienteAction } from "@/app/actions/clientes.actions"
import type { CarritoCheckout, Cliente } from "./use-carrito-checkout"

/** Selector del cliente al que se le deja a cuenta corriente el resto no
 * cubierto de un cobro dividido — con alta rápida de cliente nuevo (solo
 * nombre) para no frenar la venta buscando el form completo de Config. */
function SelectorClienteFiado({ clientes, clienteFiadoId, setClienteFiadoId }: {
  clientes: Cliente[] | undefined
  clienteFiadoId: string | null
  setClienteFiadoId: (id: string | null) => void
}) {
  const qc = useQueryClient()
  const [creando, setCreando] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState("")
  const [loading, setLoading] = useState(false)

  async function crear() {
    if (!nombreNuevo.trim()) return
    setLoading(true)
    try {
      const cliente = await crearClienteAction({ nombre: nombreNuevo.trim() })
      qc.invalidateQueries({ queryKey: ["clientes"] })
      setClienteFiadoId(cliente.id)
      setCreando(false)
      setNombreNuevo("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el cliente")
    } finally {
      setLoading(false)
    }
  }

  if (creando) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); crear() } }}
          placeholder="Nombre del cliente"
          className="flex-1 min-w-0 rounded-xl border border-border/60 bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button size="sm" onClick={crear} disabled={loading || !nombreNuevo.trim()}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Crear"}
        </Button>
        <button type="button" onClick={() => setCreando(false)} className="text-xs text-muted-foreground hover:underline shrink-0">
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={clienteFiadoId ?? ""}
        onChange={(e) => setClienteFiadoId(e.target.value || null)}
        className="flex-1 min-w-0 rounded-xl border border-border/60 bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">Elegir cliente</option>
        {clientes?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>
      <button type="button" onClick={() => setCreando(true)} className="text-xs text-primary hover:underline shrink-0">
        + Nuevo
      </button>
    </div>
  )
}

/** Diálogo compartido por los dos puntos de entrada del cierre manual de
 * emergencia (pantalla de espera y previo a intentar con el dispositivo). */
function DialogoCobroManual({
  open, onOpenChange, loading, onConfirmar,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  loading: boolean
  onConfirmar: (comprobante: string) => void
}) {
  const [comprobante, setComprobante] = useState("")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cobro manual de emergencia</DialogTitle>
          <DialogDescription>
            Usalo si cobraste con otra terminal aparte (posnet/QR en modo manual, sin
            integración). La venta queda registrada con el mismo medio de pago.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="comprobante-manual">Últimos 4 dígitos del comprobante (opcional)</Label>
          <Input
            id="comprobante-manual"
            value={comprobante}
            onChange={(e) => setComprobante(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="Ej: 1234"
            inputMode="numeric"
            maxLength={4}
            className="rounded-xl"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirmar(comprobante)} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Registrar cobro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface CarritoResumenPanelProps {
  checkout: CarritoCheckout
  /** Repetir el detalle de líneas acá (venta rápida en overlay, sin lista aparte). */
  mostrarItems?: boolean
  /** Mostrar botón "Expandir a /vender" (sólo en overlay) */
  expandAction?: React.ReactNode
}

export function CarritoResumenPanel({ checkout, mostrarItems = false, expandAction }: CarritoResumenPanelProps) {
  const {
    venta, carrito, medioPagoId, mediosPago, medioPagoSeleccionado, subtotal,
    totalCentavos, comisionCentavos, recargoTotalCentavos, totalACobrarCentavos, faltaPeso,
    descuentoPct, descuentoCentavos, setDescuentoPct, esConsumoInterno, setConsumoInterno,
    loading, successInfo, setSuccessInfo, confirmVaciar, setConfirmVaciar,
    manualDialogOpen, setManualDialogOpen, manualLoading, confirmarCobroManual,
    vaciarCarrito, setMedioPago, confirmar, cancelarPagoMp,
    pagosSplit, sumaPagosSplit, restanteSplit,
    iniciarPagoSplit, iniciarFiadoTotal, cancelarPagoSplit, agregarLineaPagoSplit, actualizarLineaPagoSplit, quitarLineaPagoSplit,
    clientes, clienteFiadoId, setClienteFiadoId,
  } = checkout

  // Vuelto: cuánto paga el cliente en efectivo (solo display, no afecta la venta).
  const [pagaConCentavos, setPagaConCentavos] = useState<number | null>(null)

  // Auto-cerrar la pantalla de "Venta registrada" a ~1,8s y limpiar el vuelto —
  // el cajero no tiene que clickear "Listo" en cada venta (el foco ya vuelve
  // solo al buscador, ver vender-client). Sigue estando el botón "Listo" por si
  // quiere cerrarla antes.
  useEffect(() => {
    if (!successInfo) return
    setPagaConCentavos(null)
    const t = setTimeout(() => setSuccessInfo(null), 1800)
    return () => clearTimeout(t)
  }, [successInfo, setSuccessInfo])

  if (!venta) return null

  // ── Esperando pago con MercadoPago (QR o posnet) ─────────────────────────────
  if (venta.pagoMpPendiente) {
    const mensaje =
      venta.pagoMpPendiente.tipo === "posnet"
        ? "Esperando que el cliente pase la tarjeta en el posnet…"
        : "Esperando que el cliente pague por QR…"
    return (
      <>
        <motion.div
          className="flex flex-col items-center justify-center gap-5 py-10 text-center"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
        >
          <div className="rounded-full bg-primary/8 p-5">
            <Loader2 className="size-8 text-primary animate-spin" />
          </div>
          <div className="space-y-0.5">
            <p className="text-lg font-semibold">{mensaje}</p>
            <p className="text-sm text-muted-foreground tabular-nums">
              {formatearARS(venta.pagoMpPendiente.montoCentavos)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={cancelarPagoMp} variant="ghost" size="sm" className="min-w-28">
              Cancelar
            </Button>
            <Button
              onClick={() => setManualDialogOpen(true)}
              variant="outline"
              size="sm"
              className="min-w-28"
            >
              Cobrar manual
            </Button>
          </div>
        </motion.div>
        <DialogoCobroManual
          open={manualDialogOpen}
          onOpenChange={setManualDialogOpen}
          loading={manualLoading}
          onConfirmar={confirmarCobroManual}
        />
      </>
    )
  }

  // ── Pantalla de éxito ────────────────────────────────────────────────────────
  if (successInfo) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center gap-5 py-10 text-center"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
      >
        <motion.div
          className="rounded-full bg-k-gain-muted p-5"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.08 }}
        >
          <CheckCircle2 className="size-8 text-k-gain" />
        </motion.div>
        <div className="space-y-0.5">
          <p className="text-lg font-semibold">Venta registrada</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatearARS(successInfo.totalCentavos)} · {successInfo.nombreMedioPago}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm" className="min-w-32"
            render={<a href={`/api/ventas/${successInfo.ventaId}/ticket-pdf`} download />}
          >
            <Download className="size-4" /> Ticket (PDF)
          </Button>
          <Button onClick={() => setSuccessInfo(null)} size="sm" className="min-w-32">
            Listo
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Total */}
      <div>
        <p className="text-[13px] text-muted-foreground">Total a cobrar</p>
        <p className="text-[2.5rem] leading-none font-semibold tabular-nums tracking-[-0.03em] mt-1.5">{formatearARS(totalACobrarCentavos)}</p>
        <p className="text-xs text-muted-foreground mt-1.5">
          {carrito.length === 0
            ? "Sin productos"
            : `${carrito.reduce((s, l) => s + l.cantidad, 0)} unidades`}
        </p>
      </div>

      <Separator className="bg-border/60" />

      {/* Medios de pago */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Medio de pago</p>
          {pagosSplit ? (
            <button type="button" onClick={cancelarPagoSplit} className="text-xs text-muted-foreground hover:underline">
              Un solo medio
            </button>
          ) : (
            carrito.length > 0 && (
              <div className="flex items-center gap-3">
                <button type="button" onClick={iniciarPagoSplit} className="text-xs text-muted-foreground hover:underline">
                  Dividir pago
                </button>
                <button type="button" onClick={iniciarFiadoTotal} className="text-xs text-muted-foreground hover:underline">
                  Fiar a cliente
                </button>
              </div>
            )
          )}
        </div>

        {pagosSplit ? (
          <div className="space-y-1.5">
            {pagosSplit.map((linea, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <select
                  value={linea.medioPagoId}
                  onChange={(e) => actualizarLineaPagoSplit(i, { medioPagoId: e.target.value })}
                  className="flex-1 min-w-0 rounded-xl border border-border/60 bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Elegir medio</option>
                  {mediosPago?.map((m) => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
                <input
                  type="number" step="0.01" min="0"
                  value={linea.montoCentavos ? linea.montoCentavos / 100 : ""}
                  onChange={(e) => actualizarLineaPagoSplit(i, { montoCentavos: Math.round((Number(e.target.value) || 0) * 100) })}
                  placeholder="0"
                  className="w-24 rounded-xl border border-border/60 bg-background px-2.5 py-2 text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {pagosSplit.length > 1 && (
                  <button
                    type="button"
                    onClick={() => quitarLineaPagoSplit(i)}
                    className="text-muted-foreground hover:text-k-loss text-xs px-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const nuevoIndex = pagosSplit.length
                agregarLineaPagoSplit()
                // Precarga lo que falta cubrir — evita que el cajero saque la
                // cuenta a mano cada vez que agrega una línea de pago dividido.
                if (restanteSplit > 0) actualizarLineaPagoSplit(nuevoIndex, { montoCentavos: restanteSplit })
              }}
              className="text-xs text-primary hover:underline"
            >
              + Agregar medio
            </button>
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-muted-foreground">Cobrado</span>
              <span className="tabular-nums">{formatearARS(sumaPagosSplit)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className={cn("font-medium", restanteSplit > 0 ? "text-k-loss" : "text-k-gain")}>
                {restanteSplit > 0 ? "Resta" : "Sobra"}
              </span>
              <span className={cn("tabular-nums font-medium", restanteSplit > 0 ? "text-k-loss" : "text-k-gain")}>
                {formatearARS(Math.abs(restanteSplit))}
              </span>
            </div>
            {restanteSplit > 0 && (
              <div className="space-y-1 pt-1">
                <p className="text-[11px] text-muted-foreground">
                  Dejar {formatearARS(restanteSplit)} a cuenta corriente de:
                </p>
                <SelectorClienteFiado
                  clientes={clientes}
                  clienteFiadoId={clienteFiadoId}
                  setClienteFiadoId={setClienteFiadoId}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {mediosPago?.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMedioPago(m.id)}
                className={cn(
                  "flex items-center justify-between px-4 py-3 rounded-2xl border text-sm font-medium transition-all",
                  medioPagoId === m.id
                    ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                    : "border-border/60 bg-background hover:bg-muted/40 text-foreground/80"
                )}
              >
                <span>{m.nombre}</span>
                {m.comisionBp > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {(m.comisionBp / 100).toFixed(2)}%
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Hint del flujo por teclado (descubrimiento) — solo con carrito cargado. */}
        {!pagosSplit && carrito.length > 0 && (
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
            <kbd className="rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium">↑</kbd>
            <kbd className="rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium">↓</kbd>
            elegir medio
            <span className="text-muted-foreground/50">·</span>
            <kbd className="rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium">Enter</kbd>
            cobrar
          </p>
        )}
      </div>

      {/* Resumen tipo ticket — último vistazo antes de confirmar, sin paso extra */}
      {carrito.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Resumen</p>
          {mostrarItems && (
            <div className="space-y-1">
              {carrito.map((item) => (
                <div key={item.productId} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-muted-foreground">
                    {item.esPesable ? `${((item.gramos ?? 0) / 1000).toFixed(3)}kg` : `${item.cantidad}x`} {item.nombre}
                  </span>
                  <span className="tabular-nums shrink-0">{formatearARS(subtotal(item))}</span>
                </div>
              ))}
              <Separator className="bg-border/40" />
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatearARS(totalCentavos)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Descuento</span>
            <div className="flex items-center gap-2">
              {descuentoCentavos > 0 && (
                <span className="text-k-loss tabular-nums">−{formatearARS(descuentoCentavos)}</span>
              )}
              <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background pr-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  value={descuentoPct || ""}
                  onChange={(e) => setDescuentoPct(Number(e.target.value) || 0)}
                  disabled={esConsumoInterno}
                  placeholder="0"
                  className="h-7 w-14 rounded-lg border-0 px-2 text-right tabular-nums disabled:opacity-60"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={esConsumoInterno} onCheckedChange={(c) => setConsumoInterno(c === true)} />
            <span className="text-muted-foreground">Consumo interno / uso propio (gratis)</span>
          </label>
          {recargoTotalCentavos > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Recargo cigarrillos</span>
              <span className="tabular-nums">+{formatearARS(recargoTotalCentavos)}</span>
            </div>
          )}
          {!pagosSplit && comisionCentavos > 0 && (
            <>
              <Separator className="bg-border/40" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Comisión</span>
                <span className="text-k-loss tabular-nums">−{formatearARS(comisionCentavos)}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Neto recibido</span>
                <span className={cn("tabular-nums", recargoTotalCentavos >= comisionCentavos ? "text-k-gain" : "text-k-loss")}>
                  {formatearARS(totalACobrarCentavos - comisionCentavos)}
                </span>
              </div>
              {/* Aviso cuando el recargo no cubre la comisión */}
              {recargoTotalCentavos < comisionCentavos && (
                <div className="flex items-center gap-1.5 rounded-lg bg-k-loss/8 border border-k-loss/20 px-2.5 py-1.5 text-xs text-k-loss">
                  <AlertTriangle className="size-3 shrink-0" />
                  El recargo no cubre la comisión del medio de pago
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Vuelto — solo efectivo, solo display (no afecta la venta). Con billetes
          rápidos y "Justo" para no tener que tipear ni sacar la cuenta. */}
      {!pagosSplit && medioPagoSeleccionado?.esEfectivo && carrito.length > 0 && (
        <div className="rounded-xl bg-muted/20 border border-border/60 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium">Paga con</span>
            <div className="flex items-center rounded-lg border border-border/60 bg-background">
              <span className="pl-2.5 text-muted-foreground text-sm">$</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={pagaConCentavos != null ? pagaConCentavos / 100 : ""}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setPagaConCentavos(e.target.value === "" ? null : Math.round((Number(e.target.value) || 0) * 100))}
                placeholder="0"
                className="h-8 w-24 rounded-lg border-0 bg-transparent px-1.5 text-right tabular-nums text-sm focus:outline-none"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setPagaConCentavos(totalACobrarCentavos)}
              className="rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted/40 transition-colors"
            >
              Justo
            </button>
            {[200000, 500000, 1000000, 2000000].filter((m) => m > totalACobrarCentavos).slice(0, 4).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPagaConCentavos(m)}
                className="rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs font-medium tabular-nums hover:bg-muted/40 transition-colors"
              >
                {formatearARS(m).replace(",00", "")}
              </button>
            ))}
          </div>
          {pagaConCentavos != null && (
            <div className="flex items-center justify-between border-t border-border/40 pt-2 text-sm">
              <span className="font-medium">{pagaConCentavos >= totalACobrarCentavos ? "Vuelto" : "Falta"}</span>
              <span className={cn("text-base font-semibold tabular-nums", pagaConCentavos >= totalACobrarCentavos ? "text-k-gain" : "text-k-loss")}>
                {formatearARS(Math.abs(pagaConCentavos - totalACobrarCentavos))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="space-y-2 mt-auto">
        {expandAction}
        <Button
          className="w-full h-12 rounded-2xl text-[15px] font-semibold"
          disabled={
            carrito.length === 0 || loading || faltaPeso ||
            (pagosSplit
              ? pagosSplit.some((p) => !p.medioPagoId) || (restanteSplit > 0 && !clienteFiadoId)
              : !medioPagoId)
          }
          onClick={confirmar}
        >
          {loading ? <Loader2 className="size-5 animate-spin" /> : "Confirmar venta"}
        </Button>
        {!pagosSplit && medioPagoSeleccionado?.esMercadoPago && carrito.length > 0 && !faltaPeso && (
          <Button
            variant="ghost"
            className="w-full text-xs text-muted-foreground h-8"
            disabled={loading}
            onClick={() => setManualDialogOpen(true)}
          >
            Cobrar con otro dispositivo (manual)
          </Button>
        )}
        <DialogoCobroManual
          open={manualDialogOpen}
          onOpenChange={setManualDialogOpen}
          loading={manualLoading}
          onConfirmar={confirmarCobroManual}
        />
        {carrito.length > 0 && (
          confirmVaciar ? (
            <div className="flex items-center justify-center gap-3 h-8 text-xs">
              <span className="text-k-loss font-medium">¿Vaciar carrito?</span>
              <button
                type="button"
                className="text-k-loss font-semibold hover:underline"
                onClick={() => { vaciarCarrito(); setConfirmVaciar(false) }}
              >
                Sí, vaciar
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:underline"
                onClick={() => setConfirmVaciar(false)}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="w-full text-xs text-muted-foreground h-8"
              onClick={() => setConfirmVaciar(true)}
            >
              Vaciar carrito
            </Button>
          )
        )}
      </div>
    </div>
  )
}
