"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ClipboardCheck, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { formatearARS } from "@/domain/dinero"
import { registrarArqueoParcialAction } from "@/app/actions/cajaSesion.actions"

interface ArqueoPendiente {
  cajaId: string
  cajaNombre: string
  cajaSesionId: string
  horario: string
  efectivoEsperadoCentavos: number
}

/**
 * Aviso persistente (no bloqueante — es un conteo de control, no vale la
 * pena frenar ventas por esto) de que hay un arqueo parcial pendiente en
 * algún horario de control del día (ver Organization.horariosArqueo). Chip
 * flotante que se puede cerrar; vuelve a aparecer en el próximo poll si
 * sigue pendiente, hasta que se registre el conteo.
 *
 * El <Dialog> de abajo solo se desmonta cuando NO está abierto — nunca
 * mientras `open` es true, aunque el polling detecte que ya no quedan
 * pendientes (p.ej. otro usuario lo registró desde otra sesión). Ver el
 * comentario largo en TraspasoCigarrillosGate sobre por qué desmontar un
 * <Dialog> abierto de golpe puede dejar toda la app sin responder a clicks.
 */
export function ArqueoParcialGate() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [cerradoManualmente, setCerradoManualmente] = useState(false)
  const [contado, setContado] = useState("")
  const [nota, setNota] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data } = useQuery<ArqueoPendiente[]>({
    queryKey: ["arqueos-pendientes"],
    queryFn: () => fetch("/api/cajas/arqueos-pendientes").then((r) => r.json()),
    refetchInterval: 30_000,
  })

  const pendientes = data ?? []
  if (pendientes.length === 0 && !open) return null

  const actual = pendientes[0]

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!actual) return
    const montoCentavos = Math.round(parseFloat(contado) * 100)
    if (!Number.isFinite(montoCentavos) || montoCentavos < 0) { toast.error("Ingresá un monto válido"); return }
    setIsSubmitting(true)
    try {
      await registrarArqueoParcialAction(actual.cajaSesionId, { efectivoContadoCentavos: montoCentavos, nota: nota || undefined })
      toast.success(`Arqueo de ${actual.cajaNombre} registrado`)
      setContado("")
      setNota("")
      qc.invalidateQueries({ queryKey: ["arqueos-pendientes"] })
      if (pendientes.length <= 1) setOpen(false)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setIsSubmitting(false) }
  }

  if (!open) {
    if (cerradoManualmente) return null
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-32 right-4 lg:bottom-16 z-40 flex items-center gap-1.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 px-3 py-2 text-xs font-medium shadow-lg backdrop-blur-xl hover:bg-blue-500/20 transition-colors"
      >
        <ClipboardCheck className="size-3.5" />
        Arqueo pendiente{pendientes.length > 1 ? ` (${pendientes.length})` : ""}: {actual.cajaNombre}
      </button>
    )
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) { setOpen(false); setCerradoManualmente(true) } }}>
      <DialogContent>
        {actual ? (
          <>
            <DialogHeader>
              <DialogTitle>Arqueo de control — {actual.cajaNombre}</DialogTitle>
              <DialogDescription>
                Conteo de control del horario de las {new Date(actual.horario).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}.
                No cierra la caja, solo deja registro para detectar diferencias temprano.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border border-border/60 bg-card px-4 py-3 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Esperado según el sistema</p>
              <p className="text-lg font-semibold tabular-nums">{formatearARS(actual.efectivoEsperadoCentavos)}</p>
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
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
            {pendientes.length > 1 && (
              <p className="text-xs text-muted-foreground text-center">
                +{pendientes.length - 1} caja{pendientes.length - 1 === 1 ? "" : "s"} más pendiente{pendientes.length - 1 === 1 ? "" : "s"}
              </p>
            )}
          </>
        ) : (
          <DialogHeader>
            <DialogTitle>Arqueo de control</DialogTitle>
            <DialogDescription>Ya no quedan arqueos pendientes.</DialogDescription>
          </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  )
}
