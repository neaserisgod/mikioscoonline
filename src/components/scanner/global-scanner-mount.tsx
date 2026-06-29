"use client"

import { useGlobalScanner } from "./use-global-scanner"

/** Componente sin UI — solo monta el hook del escáner global en el layout */
export function GlobalScannerMount() {
  useGlobalScanner()
  return null
}
