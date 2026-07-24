"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ArrowLeft, ChevronRight, Package, ClipboardList, Loader2 } from "lucide-react"
import { listarProductosRecuentoAction, guardarRecuentoAction } from "@/app/actions/recuento.actions"

interface Proveedor {
  id: string
  nombre: string
  totalProductos: number
}

interface Producto {
  id: string
  nombre: string
  sku: string
  esPesable: boolean
  stock: number
  stockGramos: number | null
}

/** Entrada de la lista corrida — sistemaValor/contadoValor en la misma unidad
 * (gramos si esPesable, unidades si no) para poder restarlas directo. */
interface Contado {
  productId: string
  nombreProducto: string
  esPesable: boolean
  sistemaValor: number
  contadoValor: number
}

function formatearCantidad(valor: number, esPesable: boolean): string {
  return esPesable ? `${(valor / 1000).toFixed(3)}kg` : `${valor}`
}

export function RecuentoClient({ proveedores, esAdmin }: { proveedores: Proveedor[]; esAdmin: boolean }) {
  const [proveedorActivo, setProveedorActivo] = useState<Proveedor | null>(null)
  const [productos, setProductos] = useState<Producto[] | null>(null)
  const [cargando, setCargando] = useState(false)
  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const [contados, setContados] = useState<Map<string, Contado>>(new Map())
  const [mostrarResumen, setMostrarResumen] = useState(false)

  async function abrirProveedor(p: Proveedor) {
    setProveedorActivo(p)
    setProductos(null)
    setCargando(true)
    try {
      const lista = await listarProductosRecuentoAction(p.id)
      setProductos(lista)
    } catch {
      toast.error("No se pudieron cargar los productos")
      setProveedorActivo(null)
    } finally {
      setCargando(false)
    }
  }

  function volver() {
    setProveedorActivo(null)
    setProductos(null)
    setExpandidoId(null)
  }

  async function guardarConteo(producto: Producto, valorIngresado: string) {
    const numero = Number(valorIngresado.replace(",", "."))
    if (!Number.isFinite(numero) || numero < 0) {
      toast.error("Ingresá un valor válido")
      return
    }
    const cantidadContada = producto.esPesable ? Math.round(numero * 1000) : Math.round(numero)

    try {
      await guardarRecuentoAction({ productId: producto.id, cantidadContada })
      toast.success(`${producto.nombre}: guardado`)
      setContados((prev) => {
        const copia = new Map(prev)
        copia.set(producto.id, {
          productId: producto.id,
          nombreProducto: producto.nombre,
          esPesable: producto.esPesable,
          sistemaValor: producto.esPesable ? (producto.stockGramos ?? 0) : producto.stock,
          contadoValor: cantidadContada,
        })
        return copia
      })
      setExpandidoId(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el recuento")
    }
  }

  if (!esAdmin) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 text-center">
        <p className="text-muted-foreground">Solo un usuario ADMIN puede cargar recuentos de stock.</p>
      </div>
    )
  }

  const listaContados = Array.from(contados.values())

  return (
    <div className="max-w-md mx-auto min-h-dvh flex flex-col">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/60 px-4 h-14 flex items-center gap-2">
        {proveedorActivo ? (
          <Button variant="ghost" size="icon" className="size-8 -ml-1.5 shrink-0" onClick={volver} aria-label="Volver">
            <ArrowLeft className="size-4" />
          </Button>
        ) : (
          <Package className="size-4.5 text-muted-foreground shrink-0" />
        )}
        <h1 className="font-heading font-semibold truncate">
          {proveedorActivo ? proveedorActivo.nombre : "Recuento de stock"}
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        {!proveedorActivo && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">Elegí un proveedor para contar sus productos.</p>
            {proveedores.map((p) => (
              <button
                key={p.id}
                onClick={() => abrirProveedor(p)}
                className="w-full flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3.5 text-left active:bg-muted/60"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.nombre}</div>
                  <div className="text-xs text-muted-foreground">{p.totalProductos} producto{p.totalProductos === 1 ? "" : "s"}</div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}

        {proveedorActivo && cargando && (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="size-4 animate-spin" />
            Cargando productos…
          </div>
        )}

        {proveedorActivo && !cargando && productos && (
          <div className="space-y-2">
            {productos.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">Este proveedor no tiene productos activos.</p>
            )}
            {productos.map((p) => {
              const yaContado = contados.get(p.id)
              const abierto = expandidoId === p.id
              const sistemaValor = p.esPesable ? (p.stockGramos ?? 0) : p.stock
              return (
                <div key={p.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandidoId(abierto ? null : p.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left active:bg-muted/60"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.nombre}</div>
                      <div className="text-xs text-muted-foreground">
                        Sistema: {formatearCantidad(sistemaValor, p.esPesable)}
                        {yaContado && (
                          <span className="text-k-gain"> · contado {formatearCantidad(yaContado.contadoValor, p.esPesable)}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className={cn("size-4 text-muted-foreground shrink-0 transition-transform", abierto && "rotate-90")} />
                  </button>
                  {abierto && (
                    <ContarProducto
                      producto={p}
                      onGuardar={(valor) => guardarConteo(p, valor)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {listaContados.length > 0 && (
        <div className="sticky bottom-0 border-t border-border/60 bg-background">
          <button
            onClick={() => setMostrarResumen((v) => !v)}
            className="w-full flex items-center justify-between px-4 h-12 text-sm font-medium"
          >
            <span className="flex items-center gap-2">
              <ClipboardList className="size-4" />
              Contados esta sesión ({listaContados.length})
            </span>
            <ChevronRight className={cn("size-4 transition-transform", mostrarResumen && "-rotate-90")} />
          </button>
          {mostrarResumen && (
            <div className="max-h-56 overflow-y-auto border-t border-border/60 divide-y divide-border/60">
              {listaContados.map((c) => {
                const delta = c.contadoValor - c.sistemaValor
                return (
                  <div key={c.productId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="truncate">{c.nombreProducto}</span>
                    <span
                      className={cn(
                        "shrink-0 tabular-nums font-medium",
                        delta > 0 ? "text-k-gain" : delta < 0 ? "text-k-loss" : "text-muted-foreground"
                      )}
                    >
                      {delta > 0 ? "+" : ""}
                      {formatearCantidad(delta, c.esPesable)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ContarProducto({ producto, onGuardar }: { producto: Producto; onGuardar: (valor: string) => void | Promise<void> }) {
  const [valor, setValor] = useState("")
  const [guardando, setGuardando] = useState(false)

  async function handleGuardar() {
    setGuardando(true)
    try {
      await onGuardar(valor)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="px-4 pb-4 pt-1 border-t border-border/60 flex items-center gap-2">
      <input
        type="number"
        step={producto.esPesable ? "0.001" : "1"}
        min="0"
        inputMode="decimal"
        autoFocus
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        placeholder={producto.esPesable ? "kg contados" : "unidades contadas"}
        className="flex-1 h-11 rounded-xl border border-border/60 bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <Button onClick={handleGuardar} disabled={guardando || valor === ""} className="h-11">
        {guardando ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
      </Button>
    </div>
  )
}
