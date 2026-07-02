"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useVentasStore } from "@/stores/ventas.store"
import { sumarStockEscanerAction } from "@/app/actions/stock.actions"

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

/**
 * Lógica compartida para "qué hacer con un código de barras leído",
 * sin importar si vino de una pistola física (teclado) o de la cámara.
 */
export function useBarcodeHandler() {
  const router = useRouter()
  const { agregarProducto, setOverlay } = useVentasStore()

  const handleScan = useCallback(async (barcode: string) => {
    const pref = getScannerPref()
    const pathname = window.location.pathname
    const inProductos = pathname.startsWith("/productos") || pathname.startsWith("/stock")
    const inVender = pathname.startsWith("/vender")

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

    // ── Caso: código ENCONTRADO, cualquier pantalla → agregar al carrito ──────
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
      // El carrito ya está visible en /vender — abrir el overlay ahí sería redundante
      if (!inVender) setOverlay(true)
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
    if (!inVender) setOverlay(true)
    toast.success(`${producto.nombre} agregado`, { duration: 1500 })
  }, [router, agregarProducto, setOverlay])

  return handleScan
}
