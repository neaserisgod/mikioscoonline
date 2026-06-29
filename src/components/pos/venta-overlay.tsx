"use client"

import { useRouter } from "next/navigation"
import { Maximize2 } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { CarritoPanel } from "./carrito-panel"
import { VentaSwitcher } from "./venta-switcher"
import { useVentasStore } from "@/stores/ventas.store"

export function VentaOverlay() {
  const { overlayAbierto, setOverlay } = useVentasStore()
  const router = useRouter()

  function expandir() {
    setOverlay(false)
    router.push("/vender")
  }

  return (
    <Sheet open={overlayAbierto} onOpenChange={setOverlay}>
      <SheetContent side="right" className="w-full sm:max-w-sm flex flex-col gap-0 p-0 overflow-hidden">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60 shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Venta rápida</SheetTitle>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Expandir a POS completo"
              onClick={expandir}
              className="text-muted-foreground hover:text-foreground"
            >
              <Maximize2 className="size-3.5" />
            </Button>
          </div>
          <div className="mt-2">
            <VentaSwitcher />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <CarritoPanel
            compact
            onSuccess={() => {
              // Se queda abierto para la próxima venta; el store ya cicló
            }}
            expandAction={
              <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={expandir}>
                <Maximize2 className="size-3.5 mr-1.5" />
                POS completo
              </Button>
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
