"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Maximize2, Camera } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { CarritoPanel } from "./carrito-panel"
import { VentaSwitcher } from "./venta-switcher"
import { CajaEstadoBar } from "./caja-estado-bar"
import { CameraScannerSheet } from "@/components/scanner/camera-scanner-sheet"
import { useVentasStore } from "@/stores/ventas.store"

export function VentaOverlay() {
  const { overlayAbierto, setOverlay } = useVentasStore()
  const router = useRouter()
  const [cameraOpen, setCameraOpen] = useState(false)

  function expandir() {
    setOverlay(false)
    router.push("/vender")
  }

  return (
    <>
      <Sheet open={overlayAbierto} onOpenChange={setOverlay}>
        <SheetContent side="right" className="w-full sm:max-w-sm flex flex-col gap-0 p-0 overflow-hidden">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60 shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base">Venta rápida</SheetTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Escanear código con la cámara"
                  onClick={() => setCameraOpen(true)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Camera className="size-3.5" />
                </Button>
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
            </div>
            <div className="mt-2">
              <VentaSwitcher />
            </div>
            <div className="mt-2">
              <CajaEstadoBar compact />
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

      <CameraScannerSheet open={cameraOpen} onOpenChange={setCameraOpen} />
    </>
  )
}
