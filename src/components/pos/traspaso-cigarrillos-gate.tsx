"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Clock } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { formatearARS } from "@/domain/dinero"
import { confirmarTraspasoCigarrillosAction } from "@/app/actions/ventas.actions"

interface TraspasoPendiente {
  id: string
  fecha: string
  traspasoCigarrillosCentavos: number
}
interface TraspasoPendienteResponse {
  pendientes: TraspasoPendiente[]
  totalCentavos: number
  /** Hay efectivo físico suficiente en Caja general para hacer el traspaso
   * AHORA. Si no lo hay, no tiene sentido bloquear la pantalla pidiendo
   * confirmar algo que no se puede hacer todavía — queda en cola hasta que
   * entre efectivo suficiente (venta en efectivo o ingreso manual). */
  bloqueante: boolean
}

/**
 * Popup bloqueante (sin botón de cerrar, sin click afuera, sin Escape) que
 * aparece en CUALQUIER pantalla del dashboard mientras haya una venta de
 * cigarrillos por QR/Posnet sin su traspaso físico confirmado Y haya
 * efectivo suficiente en Caja general para hacerlo — el proveedor de
 * cigarrillos solo acepta efectivo, así que hay que sacar plata de Caja
 * general y pasarla a mano a Caja Cigarrillos antes de poder seguir.
 */
export function TraspasoCigarrillosGate() {
  const qc = useQueryClient()
  const [confirmando, setConfirmando] = useState(false)

  const { data } = useQuery<TraspasoPendienteResponse>({
    queryKey: ["traspaso-pendiente"],
    queryFn: () => fetch("/api/ventas/traspaso-pendiente").then((r) => r.json()),
    refetchInterval: 4000,
  })

  const pendientes = data?.pendientes ?? []
  if (pendientes.length === 0) return null

  // En cola: hay traspaso(s) pendiente(s) pero no efectivo suficiente para
  // hacerlos todavía — no bloquear, solo avisar con un chip flotante. En
  // cuanto entre efectivo (el polling de 4s lo detecta), pasa a bloqueante.
  if (!data?.bloqueante) {
    return <ColaFlotante cantidad={pendientes.length} totalCentavos={data?.totalCentavos ?? 0} />
  }

  const actual = pendientes[0]

  async function confirmar() {
    setConfirmando(true)
    try {
      await confirmarTraspasoCigarrillosAction(actual.id)
      await qc.invalidateQueries({ queryKey: ["traspaso-pendiente"] })
      qc.invalidateQueries({ queryKey: ["cajas-panel"] })
      qc.invalidateQueries({ queryKey: ["resumen"] })
    } finally {
      setConfirmando(false)
    }
  }

  return (
    <Dialog open disablePointerDismissal>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Traspaso de cigarrillos pendiente</DialogTitle>
          <DialogDescription>
            Vendiste cigarrillos por QR/Posnet — el proveedor solo acepta efectivo. Pasá{" "}
            <strong>{formatearARS(actual.traspasoCigarrillosCentavos)}</strong> de Caja general a Caja
            Cigarrillos en efectivo, y recién ahí confirmá acá abajo.
          </DialogDescription>
        </DialogHeader>
        <Button onClick={confirmar} disabled={confirmando} className="w-full">
          {confirmando ? <Loader2 className="size-4 animate-spin" /> : "Ya hice el traspaso físico"}
        </Button>
        {pendientes.length > 1 && (
          <p className="text-xs text-muted-foreground text-center">
            +{pendientes.length - 1} traspaso{pendientes.length - 1 === 1 ? "" : "s"} más pendiente{pendientes.length - 1 === 1 ? "" : "s"}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Chip flotante, no bloqueante — visible en cualquier pantalla mientras el
 * traspaso está en cola por falta de efectivo. Dismissible (a diferencia del
 * gate real): solo informa, no exige nada porque todavía no se puede hacer. */
function ColaFlotante({ cantidad, totalCentavos }: { cantidad: number; totalCentavos: number }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 lg:bottom-4 z-40 flex items-center gap-1.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-3 py-2 text-xs font-medium shadow-lg backdrop-blur-xl hover:bg-amber-500/20 transition-colors"
      >
        <Clock className="size-3.5" />
        Traspaso en cola · {formatearARS(totalCentavos)}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Traspaso de cigarrillos en cola</DialogTitle>
            <DialogDescription>
              Vendiste cigarrillos por QR/Posnet ({formatearARS(totalCentavos)}
              {cantidad > 1 ? ` en ${cantidad} ventas` : ""}), pero todavía no hay suficiente efectivo en Caja
              general para pasarlo a Caja Cigarrillos. En cuanto entre efectivo suficiente (una venta en
              efectivo o un ingreso manual), te vamos a pedir que confirmes el traspaso.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  )
}
