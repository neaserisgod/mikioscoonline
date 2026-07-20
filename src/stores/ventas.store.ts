"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { TipoDispositivoMp } from "@/app/actions/pagos.actions"

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
  /** Categoría Cigarrillos — determina el recargo escalonado por QR/Posnet. */
  esCigarrillo: boolean
  /** Cigarrillo suelto (no atado) — recargo distinto al de atados. */
  esCigarroSuelto: boolean
}

export interface LineaPago {
  medioPagoId: string
  montoCentavos: number
}

export interface PagoMpPendiente {
  tipo: TipoDispositivoMp
  orderId: string
  montoCentavos: number
  /** Descuento ya restado de montoCentavos — se re-envía tal cual al crear la venta. */
  descuentoCentavos: number
  iniciadoEn: number
}

export interface VentaAbierta {
  id: string
  label: string
  carrito: LineaCarrito[]
  medioPagoId: string
  /** Cobro dividido: null = modo simple (un solo medio, medioPagoId, por el
   * total). Array = modo dividido, cada línea con su propio medio y monto —
   * el cajero arma la suma a mano y debe cubrir el total antes de confirmar.
   * En modo dividido la venta se crea directo (sin pasar por el flujo de
   * espera de MercadoPago), igual que el cobro manual de emergencia. */
  pagosSplit: LineaPago[] | null
  /** Descuento manual del cajero, en % (0-100) sobre el subtotal de productos. */
  descuentoPct: number
  /** Consumo de personal o del dueño — no es una venta real, se cobra $0 (fuerza descuentoPct a 100). */
  esConsumoInterno: boolean
  /** Cobro con MercadoPago (QR o posnet) esperando confirmación — null si no hay ninguno en curso. */
  pagoMpPendiente: PagoMpPendiente | null
}

export type ProductoParaCarrito = Pick<
  LineaCarrito,
  | "productId" | "nombre" | "sku" | "precioUnitarioCentavos" | "stock" | "esPesable" | "stockGramos"
  | "esCigarrillo" | "esCigarroSuelto"
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
  agregarProducto: (p: ProductoParaCarrito, cantidad?: number) => void
  cambiarCantidad: (productId: string, delta: number) => void
  setCantidad: (productId: string, cantidad: number) => void
  setGramos: (productId: string, gramos: number) => void
  eliminarLinea: (productId: string) => void
  vaciarCarrito: () => void
  setMedioPago: (medioPagoId: string) => void
  iniciarPagoSplit: (totalCentavos: number) => void
  iniciarFiadoTotal: () => void
  cancelarPagoSplit: () => void
  agregarLineaPagoSplit: () => void
  actualizarLineaPagoSplit: (index: number, patch: Partial<LineaPago>) => void
  quitarLineaPagoSplit: (index: number) => void
  setDescuentoPct: (pct: number) => void
  setConsumoInterno: (activo: boolean) => void
  // Llamar tras confirmar venta exitosa: vacía el carrito de la venta activa, sin cambiar de pestaña
  onVentaConfirmada: () => void
  // Las siguientes tres operan por id (no necesariamente la venta activa) porque el cobro
  // con MercadoPago sigue esperando confirmación en background aunque el cajero cambie de pestaña.
  iniciarPagoMp: (ventaId: string, data: PagoMpPendiente) => void
  cancelarPagoMp: (ventaId: string) => void
  confirmarPagoMp: (ventaId: string) => void
}

function crearVentaVacia(n: number): VentaAbierta {
  return {
    id: crypto.randomUUID(),
    label: `Venta ${n}`,
    carrito: [],
    medioPagoId: "",
    pagosSplit: null,
    descuentoPct: 0,
    esConsumoInterno: false,
    pagoMpPendiente: null,
  }
}

function ventaActiva(state: VentasState): VentaAbierta | undefined {
  return state.ventas.find((v) => v.id === state.ventaActivaId)
}

// Persistido en sessionStorage (no localStorage: es un cajón por pestaña, no
// algo que deba sobrevivir entre pestañas/dispositivos distintos) — sobrevive
// a un F5 accidental con un cobro de MercadoPago pendiente. Antes, recargar la
// página con `pagoMpPendiente` seteado perdía ese estado sin dejar rastro: si
// el cliente ya había pagado (o pagaba después), la venta nunca se registraba
// (ver docs/REPORTE-NUCLEO.md, hallazgo C1). No cubre cierre de pestaña/crash
// del navegador — eso lo cubre el backstop de mercadopago-comisiones.ts.
export const useVentasStore = create<VentasState & VentasActions>()(
  persist((set, get) => {
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

    agregarProducto(p, cantidad) {
      set((s) => {
        const activa = ventaActiva(s)
        if (!activa) return s
        const existe = activa.carrito.find((l) => l.productId === p.productId)

        if (p.esPesable) {
          // Pesable: una sola línea por producto. El peso se carga a mano en el carrito,
          // salvo que venga por prefijo ("200 queso" = 200 g). Si ya estaba en el carrito,
          // refrescamos el stock cacheado (re-buscar/re-escanear es la única señal de que el
          // stock pudo cambiar) y, si vino un prefijo, se SUMAN esos gramos.
          if (existe) {
            const nuevoCarrito = activa.carrito.map((l) =>
              l.productId === p.productId
                ? {
                    ...l,
                    stockGramos: p.stockGramos,
                    gramos: cantidad != null
                      ? (l.gramos ?? 0) + cantidad
                      : Math.min(l.gramos ?? 0, p.stockGramos ?? 0),
                  }
                : l
            )
            return {
              ventas: s.ventas.map((v) => (v.id === activa.id ? { ...v, carrito: nuevoCarrito } : v)),
            }
          }
          if ((p.stockGramos ?? 0) <= 0) return s
          const nuevoCarrito = [...activa.carrito, { ...p, cantidad: 1, gramos: cantidad ?? 0 }]
          return {
            ventas: s.ventas.map((v) => (v.id === activa.id ? { ...v, carrito: nuevoCarrito } : v)),
          }
        }

        let nuevoCarrito: LineaCarrito[]
        if (existe) {
          // Igual que en pesables: refrescar el stock cacheado en la línea, haya o no lugar
          // para sumar una unidad más.
          if (existe.cantidad >= p.stock) {
            nuevoCarrito = activa.carrito.map((l) =>
              l.productId === p.productId ? { ...l, stock: p.stock } : l
            )
          } else {
            nuevoCarrito = activa.carrito.map((l) =>
              l.productId === p.productId ? { ...l, cantidad: l.cantidad + (cantidad ?? 1), stock: p.stock } : l
            )
          }
        } else {
          if (p.stock < 1) return s
          nuevoCarrito = [...activa.carrito, { ...p, cantidad: cantidad ?? 1, gramos: null }]
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

    // Sin tope superior contra el stock cacheado — mismo criterio que
    // setGramos (ver comentario ahí): permite tipear libre, el carrito avisa
    // si supera el stock y el servidor valida el stock real al confirmar.
    setCantidad(productId, cantidad) {
      set((s) => {
        const activa = ventaActiva(s)
        if (!activa) return s
        const nuevoCarrito = activa.carrito
          .map((l) => (l.productId === productId ? { ...l, cantidad: Math.max(0, Math.round(cantidad)) } : l))
          .filter((l) => l.cantidad > 0)
        return {
          ventas: s.ventas.map((v) => (v.id === activa.id ? { ...v, carrito: nuevoCarrito } : v)),
        }
      })
    },

    setGramos(productId, gramos) {
      set((s) => {
        const activa = ventaActiva(s)
        if (!activa) return s
        // Sin tope superior acá: el stock cacheado en la línea puede haber quedado
        // desactualizado (se refresca recién al re-buscar/re-escanear el producto — ver
        // agregarProducto) y clampear en silencio contra un valor viejo es indistinguible
        // de un bug para el cajero. El servidor valida el stock real al confirmar la venta
        // y devuelve un error claro; acá solo se avisa (ver carrito-items-list.tsx).
        const nuevoCarrito = activa.carrito.map((l) =>
          l.productId === productId ? { ...l, gramos: Math.max(0, Math.round(gramos)) } : l
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

    iniciarPagoSplit(totalCentavos) {
      set((s) => {
        const activa = ventaActiva(s)
        if (!activa) return s
        const primeraLinea: LineaPago = { medioPagoId: activa.medioPagoId, montoCentavos: totalCentavos }
        return {
          ventas: s.ventas.map((v) => (v.id === activa.id ? { ...v, pagosSplit: [primeraLinea, { medioPagoId: "", montoCentavos: 0 }] } : v)),
        }
      })
    },

    // Fiar el 100% de la venta a un cliente, sin cobrar nada por ningún medio —
    // arranca en 0 líneas de pago (a diferencia de iniciarPagoSplit, que arranca
    // con 1 línea por el total): el checkout ya sabe mostrar "Resta: $total" y
    // pedir el cliente cuando pagosSplit no cubre el total.
    iniciarFiadoTotal() {
      set((s) => {
        const activa = ventaActiva(s)
        if (!activa) return s
        return {
          ventas: s.ventas.map((v) => (v.id === activa.id ? { ...v, pagosSplit: [] } : v)),
        }
      })
    },

    cancelarPagoSplit() {
      set((s) => {
        const activa = ventaActiva(s)
        if (!activa) return s
        return {
          ventas: s.ventas.map((v) => (v.id === activa.id ? { ...v, pagosSplit: null } : v)),
        }
      })
    },

    agregarLineaPagoSplit() {
      set((s) => {
        const activa = ventaActiva(s)
        if (!activa || !activa.pagosSplit) return s
        const nuevo = [...activa.pagosSplit, { medioPagoId: "", montoCentavos: 0 }]
        return {
          ventas: s.ventas.map((v) => (v.id === activa.id ? { ...v, pagosSplit: nuevo } : v)),
        }
      })
    },

    actualizarLineaPagoSplit(index, patch) {
      set((s) => {
        const activa = ventaActiva(s)
        if (!activa || !activa.pagosSplit) return s
        const nuevo = activa.pagosSplit.map((l, i) => (i === index ? { ...l, ...patch } : l))
        return {
          ventas: s.ventas.map((v) => (v.id === activa.id ? { ...v, pagosSplit: nuevo } : v)),
        }
      })
    },

    quitarLineaPagoSplit(index) {
      set((s) => {
        const activa = ventaActiva(s)
        if (!activa || !activa.pagosSplit) return s
        const nuevo = activa.pagosSplit.filter((_, i) => i !== index)
        return {
          ventas: s.ventas.map((v) => (v.id === activa.id ? { ...v, pagosSplit: nuevo.length > 0 ? nuevo : null } : v)),
        }
      })
    },

    setDescuentoPct(pct) {
      set((s) => {
        const activa = ventaActiva(s)
        if (!activa) return s
        const clamped = Math.max(0, Math.min(100, pct))
        return {
          ventas: s.ventas.map((v) => (v.id === activa.id ? { ...v, descuentoPct: clamped } : v)),
        }
      })
    },

    setConsumoInterno(activo) {
      set((s) => {
        const activa = ventaActiva(s)
        if (!activa) return s
        return {
          ventas: s.ventas.map((v) =>
            v.id === activa.id ? { ...v, esConsumoInterno: activo, descuentoPct: activo ? 100 : 0 } : v
          ),
        }
      })
    },

    onVentaConfirmada() {
      // La pestaña confirmada se vacía y se queda activa — nunca saltamos
      // a otra venta sin que el usuario la elija explícitamente.
      set((s) => {
        const activa = ventaActiva(s)
        if (!activa) return s
        return {
          ventas: s.ventas.map((v) =>
            v.id === activa.id
              ? { ...v, carrito: [], medioPagoId: "", pagosSplit: null, descuentoPct: 0, esConsumoInterno: false }
              : v
          ),
        }
      })
    },

    iniciarPagoMp(ventaId, data) {
      set((s) => ({
        ventas: s.ventas.map((v) => (v.id === ventaId ? { ...v, pagoMpPendiente: data } : v)),
      }))
    },

    cancelarPagoMp(ventaId) {
      set((s) => ({
        ventas: s.ventas.map((v) => (v.id === ventaId ? { ...v, pagoMpPendiente: null } : v)),
      }))
    },

    confirmarPagoMp(ventaId) {
      set((s) => ({
        ventas: s.ventas.map((v) =>
          v.id === ventaId
            ? { ...v, carrito: [], medioPagoId: "", pagosSplit: null, descuentoPct: 0, pagoMpPendiente: null }
            : v
        ),
      }))
    },
  }
  },
  {
    name: "pyme-ventas-store",
    storage: createJSONStorage(() => sessionStorage),
    // overlayAbierto es puramente de UI (qué pestaña se ve al volver a entrar
    // a /vender) — no tiene sentido persistirlo entre recargas.
    partialize: (state) => ({ ventas: state.ventas, ventaActivaId: state.ventaActivaId }),
  })
)

// Selector de conveniencia: venta activa completa
export const useVentaActiva = () =>
  useVentasStore((s) => s.ventas.find((v) => v.id === s.ventaActivaId))
