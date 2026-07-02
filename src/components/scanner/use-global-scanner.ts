"use client"

import { useEffect, useRef } from "react"
import { useBarcodeHandler } from "./use-barcode-handler"

const SCAN_MIN_LENGTH = 6
const SCAN_MAX_INTERVAL_MS = 50

export function useGlobalScanner() {
  const handleScan = useBarcodeHandler()

  const bufferRef = useRef<string[]>([])
  const lastKeyTimeRef = useRef<number>(0)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Si el foco está en el buscador del POS, ese input maneja el Enter — abstenerse
      const focused = document.activeElement
      if (focused instanceof HTMLElement && focused.hasAttribute("data-pos-search-input")) {
        return
      }

      // Si el foco está en un input marcado para barcode, solo rellenar — no disparar venta
      if (focused instanceof HTMLInputElement && focused.hasAttribute("data-barcode-input")) {
        return
      }

      const now = Date.now()
      const delta = now - lastKeyTimeRef.current
      lastKeyTimeRef.current = now

      if (e.key === "Enter") {
        const candidate = bufferRef.current.join("")
        bufferRef.current = []

        if (candidate.length >= SCAN_MIN_LENGTH) {
          void handleScan(candidate)
        }
        return
      }

      // Sólo capturar caracteres alfanuméricos
      if (e.key.length !== 1) { bufferRef.current = []; return }

      if (delta > SCAN_MAX_INTERVAL_MS && bufferRef.current.length > 0) {
        // Demasiado tiempo desde última tecla → usuario tipea manualmente, limpiar
        bufferRef.current = []
      }

      bufferRef.current.push(e.key)
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [handleScan])
}
