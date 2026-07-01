"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useVentasStore } from "@/stores/ventas.store"
import { sumarStockEscanerAction } from "@/app/actions/stock.actions"

const SCAN_MIN_LENGTH = 6
const SCAN_MAX_INTERVAL_MS = 50

export type ScannerPref = "sumar-stock" | "abrir-producto"

function getScannerPref(): ScannerPref {
  if (typeof window === "undefined") return "sumar-stock"
  return (localStorage.getItem("pyme_scanner_pref") as ScannerPref) ?? "sumar-stock"
}

interface Producto {
  id: string
  nombre: string
  sku: string
  precioCentavos: number
  costoCentavos: number
  stock: number
  esPesable: boolean
  precioPorKgCentavos: number | null
  stockGramos: number | null
}

export function useGlobalScanner() {
  const router = useRouter()
  const { agregarProducto, setOverlay } = useVentasStore()

  const bufferRef = useRef<string[]>([])
  const lastKeyTimeRef = useRef<number>(0)

  useEffect(() => {
    async function handleScan(barcode: string) {
      const pref = getScannerPref()
      const pathname = window.location.pathname
      const inProductos = pathname.startsWith("/productos") || pathname.startsWith("/stock")

      let producto: Producto | null = null
      try {
        const res = await fetch(`/api/productos/codigo/${encodeURIComponent(barcode)}`)
        if (res.ok) {
          producto = await res.json() as Producto
        }
      } catch {}

      // ── Caso: código NO encontrado ────────────────────────────────────────────
      if (!producto) {
        if (inProductos) {
          // Navegar a productos con barcode prellenado — la página abre el form en modo nuevo
          router.push(`/productos?barcode=${encodeURIComponent(barcode)}`)
        } else {
          // Fuera de productos: toast con oferta de alta
          toast("Producto no encontrado", {
            description: barcode,
            action: {
              label: "Dar de alta",
              onClick: () => router.push(`/productos?barcode=${encodeURIComponent(barcode)}`),
            },
          })
        }
        return
      }

      // ── Caso: código ENCONTRADO en /productos o /stock ────────────────────────
      if (inProductos) {
        if (pref === "abrir-producto" || producto.esPesable) {
          // Los pesables no se pueden sumar "+1" — se abre el producto para cargar el peso a mano
          router.push(`/productos?abrir=${producto.id}`)
        } else {
          // sumar-stock (default)
          try {
            await sumarStockEscanerAction(producto.id)
            toast.success(`+1 ${producto.nombre}`, { description: "Stock actualizado" })
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al sumar stock")
          }
        }
        return
      }

      // ── Caso: código ENCONTRADO, cualquier pantalla → overlay + agregar ───────
      if (producto.esPesable) {
        agregarProducto({
          productId: producto.id,
          nombre: producto.nombre,
          sku: producto.sku,
          precioUnitarioCentavos: producto.precioPorKgCentavos ?? 0,
          stock: 0,
          stockGramos: producto.stockGramos,
          esPesable: true,
        })
        setOverlay(true)
        toast.success(`${producto.nombre} agregado`, { description: "Cargá el peso en el carrito", duration: 2000 })
        return
      }

      agregarProducto({
        productId: producto.id,
        nombre: producto.nombre,
        sku: producto.sku,
        precioUnitarioCentavos: producto.precioCentavos,
        stock: producto.stock,
        stockGramos: null,
        esPesable: false,
      })
      setOverlay(true)
      toast.success(`${producto.nombre} agregado`, { duration: 1500 })
    }

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
  }, [agregarProducto, setOverlay, router])
}
