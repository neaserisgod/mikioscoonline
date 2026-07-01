"use client"

import { create } from "zustand"

export interface LineaCarrito {
  productId: string
  nombre: string
  sku: string
  cantidad: number
  /** Solo pesables: gramos cargados. null en productos por unidad. */
  gramos: number | null
  esPesable: boolean
  precioUnitarioCentavos: number
  stock: number
  /** Solo pesables: gramos disponibles. null en productos por unidad. */
  stockGramos: number | null
}

export interface VentaAbierta {
  id: string
  label: string
  carrito: LineaCarrito[]
  medioPagoId: string
}

export type ProductoParaCarrito = Pick<
  LineaCarrito,
  "productId" | "nombre" | "sku" | "precioUnitarioCentavos" | "stock" | "esPesable" | "stockGramos"
>

interface VentasState {
  ventas: VentaAbierta[]
  ventaActivaId: string | null
  overlayAbierto: boolean
}

interface VentasActions {
  nuevaVenta: () => string
  activarVenta: (id: string) => void
  descartarVenta: (id: string) => void
  setOverlay: (open: boolean) => void
  agregarProducto: (p: ProductoParaCarrito) => void
  cambiarCantidad: (productId: string, delta: number) => void
  setGramos: (productId: string, gramos: number) => void
  eliminarLinea: (productId: string) => void
  vaciarCarrito: () => void
  setMedioPago: (medioPagoId: string) => void
  // Llamar tras confirmar venta exitosa: cierra esta, pasa a otra abierta o crea vacía
  onVentaConfirmada: () => void
}

function crearVentaVacia(n: number): VentaAbierta {
  return {
    id: crypto.randomUUID(),
    label: `Venta ${n}`,
    carrito: [],
    medioPagoId: "",
  }
}

function ventaActiva(state: VentasState): VentaAbierta | undefined {
  return state.ventas.find((v) => v.id === state.ventaActivaId)
}

export const useVentasStore = create<VentasState & VentasActions>((set, get) => {
  const inicial = crearVentaVacia(1)

  return {
    ventas: [inicial],
    ventaActivaId: inicial.id,
    overlayAbierto: false,

    nuevaVenta() {
      const nueva = crearVentaVacia(get().ventas.length + 1)
      set((s) => ({ ventas: [...s.ventas, nueva], ventaActivaId: nueva.id }))
      return nueva.id
    },

    activarVenta(id) {
      set({ ventaActivaId: id })
    },

    descartarVenta(id) {
      set((s) => {
        const restantes = s.ventas.filter((v) => v.id !== id)
        if (restantes.length === 0) {
          const nueva = crearVentaVacia(1)
          return { ventas: [nueva], ventaActivaId: nueva.id }
        }
        const nuevaActiva =
          s.ventaActivaId === id
            ? restantes[restantes.length - 1].id
            : s.ventaActivaId
        return { ventas: restantes, ventaActivaId: nuevaActiva }
      })
    },

    setOverlay(open) {
      set({ overlayAbierto: open })
    },

    agregarProducto(p) {
      set((s) => {
        const activa = ventaActiva(s)
        if (!activa) return s
        const existe = activa.carrito.find((l) => l.productId === p.productId)

        if (p.esPesable) {
          // Pesable: una sola línea por producto, el peso se carga a mano en el carrito
          if (existe) return s
          if ((p.stockGramos ?? 0) <= 0) return s
          const nuevoCarrito = [...activa.carrito, { ...p, cantidad: 1, gramos: 0 }]
          return {
            ventas: s.ventas.map((v) => (v.id === activa.id ? { ...v, carrito: nuevoCarrito } : v)),
          }
        }

        let nuevoCarrito: LineaCarrito[]
        if (existe) {
          // Stock validation is advisory only — server enforces the real constraint
          if (existe.cantidad >= p.stock) return s
          nuevoCarrito = activa.carrito.map((l) =>
            l.productId === p.productId ? { ...l, cantidad: l.cantidad + 1 } : l
          )
        } else {
          if (p.stock < 1) return s
          nuevoCarrito = [...activa.carrito, { ...p, cantidad: 1, gramos: null }]
        }
        return {
          ventas: s.ventas.map((v) =>
            v.id === activa.id ? { ...v, carrito: nuevoCarrito } : v
          ),
        }
      })
    },

    cambiarCantidad(productId, delta) {
      set((s) => {
        const activa = ventaActiva(s)
        if (!activa) return s
        const nuevoCarrito = activa.carrito
          .map((l) =>
            l.productId === productId
              ? { ...l, cantidad: Math.max(0, Math.min(l.stock, l.cantidad + delta)) }
              : l
          )
          .filter((l) => l.cantidad > 0)
        return {
          ventas: s.ventas.map((v) =>
            v.id === activa.id ? { ...v, carrito: nuevoCarrito } : v
          ),
        }
      })
    },

    setGramos(productId, gramos) {
      set((s) => {
        const activa = ventaActiva(s)
        if (!activa) return s
        const nuevoCarrito = activa.carrito.map((l) =>
          l.productId === productId
            ? { ...l, gramos: Math.max(0, Math.min(l.stockGramos ?? 0, Math.round(gramos))) }
            : l
        )
        return {
          ventas: s.ventas.map((v) => (v.id === activa.id ? { ...v, carrito: nuevoCarrito } : v)),
        }
      })
    },

    eliminarLinea(productId) {
      set((s) => {
        const activa = ventaActiva(s)
        if (!activa) return s
        return {
          ventas: s.ventas.map((v) =>
            v.id === activa.id
              ? { ...v, carrito: v.carrito.filter((l) => l.productId !== productId) }
              : v
          ),
        }
      })
    },

    vaciarCarrito() {
      set((s) => {
        const activa = ventaActiva(s)
        if (!activa) return s
        return {
          ventas: s.ventas.map((v) =>
            v.id === activa.id ? { ...v, carrito: [] } : v
          ),
        }
      })
    },

    setMedioPago(medioPagoId) {
      set((s) => {
        const activa = ventaActiva(s)
        if (!activa) return s
        return {
          ventas: s.ventas.map((v) =>
            v.id === activa.id ? { ...v, medioPagoId } : v
          ),
        }
      })
    },

    onVentaConfirmada() {
      set((s) => {
        const restantes = s.ventas.filter((v) => v.id !== s.ventaActivaId)
        if (restantes.length === 0) {
          // No hay otras abiertas → crear una vacía
          const nueva = crearVentaVacia(1)
          return { ventas: [nueva], ventaActivaId: nueva.id }
        }
        // Pasar a la última venta abierta que quede
        return {
          ventas: restantes,
          ventaActivaId: restantes[restantes.length - 1].id,
        }
      })
    },
  }
})

// Selector de conveniencia: venta activa completa
export const useVentaActiva = () =>
  useVentasStore((s) => s.ventas.find((v) => v.id === s.ventaActivaId))
