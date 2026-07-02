"use client"

import { useEffect, useRef, useState } from "react"
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser"
import { CameraOff } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useBarcodeHandler } from "./use-barcode-handler"

interface CameraScannerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CameraScannerSheet({ open, onOpenChange }: CameraScannerSheetProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const handleScan = useBarcodeHandler()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !videoRef.current) return

    setError(null)
    const reader = new BrowserMultiFormatReader()
    let controls: IScannerControls | null = null
    let cancelado = false

    reader
      .decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current,
        (result, _err, ctrl) => {
          controls = ctrl
          if (cancelado || !result) return
          ctrl.stop()
          onOpenChange(false)
          void handleScan(result.getText())
        }
      )
      .catch((e) => {
        setError(e instanceof Error ? e.message : "No se pudo acceder a la cámara")
      })

    return () => {
      cancelado = true
      controls?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0 overflow-hidden gap-0">
        <SheetHeader className="px-5 pt-5 pb-3">
          <SheetTitle>Escanear código</SheetTitle>
        </SheetHeader>
        <div className="relative aspect-[4/3] bg-black">
          <video ref={videoRef} className="size-full object-cover" muted playsInline />
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white bg-black/85">
              <CameraOff className="size-6" />
              {error}
            </div>
          )}
        </div>
        <p className="px-5 py-4 text-xs text-muted-foreground text-center">
          Apuntá la cámara al código de barras del producto
        </p>
      </SheetContent>
    </Sheet>
  )
}
