"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ArrowLeft, ChevronRight, Package, ClipboardList, Loader2, Send } from "lucide-react"
import { listarProductosRecuentoAction, guardarRecuentoLoteAction } from "@/app/actions/recuento.actions"

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

type Motivo = "CONSUMO" | "VENTA"

/** Estado de conteo en curso para un producto — vive mientras no se mandó (o
 * se está por re-mandar) ese proveedor. */
interface FilaEnCurso {
  valor: string
  motivo: Motivo | null
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
  const [enCurso, setEnCurso] = useState<Map<string, FilaEnCurso>>(new Map())
  const [enviando, setEnviando] = useState(false)
  const [contados, setContados] = useState<Map<string, Contado>>(new Map())
  const [mostrarResumen, setMostrarResumen] = useState(false)

  async function abrirProveedor(p: Proveedor) {
    setProveedorActivo(p)
    setProductos(null)
    setEnCurso(new Map())
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
    setEnCurso(new Map())
  }

  function setValor(productId: string, valor: string) {
    setEnCurso((prev) => {
      const copia = new Map(prev)
      copia.set(productId, { valor, motivo: copia.get(productId)?.motivo ?? null })
      return copia
    })
  }

  function setMotivo(productId: string, motivo: Motivo) {
    setEnCurso((prev) => {
      const copia = new Map(prev)
      const actual = copia.get(productId)
      copia.set(productId, { valor: actual?.valor ?? "", motivo: actual?.motivo === motivo ? null : motivo })
      return copia
    })
  }

  async function enviarTodo() {
    if (!productos) return
    const items: { productId: string; cantidadContada: number; motivo?: Motivo; producto: Producto; sistemaValor: number }[] = []

    for (const p of productos) {
      const fila = enCurso.get(p.id)
      if (!fila || fila.valor.trim() === "") continue
      const numero = Number(fila.valor.replace(",", "."))
      if (!Number.isFinite(numero) || numero < 0) {
        toast.error(`"${p.nombre}": valor inválido`)
        return
      }
      const cantidadContada = p.esPesable ? Math.round(numero * 1000) : Math.round(numero)
      const sistemaValor = p.esPesable ? (p.stockGramos ?? 0) : p.stock
      items.push({ productId: p.id, cantidadContada, motivo: fila.motivo ?? undefined, producto: p, sistemaValor })
    }

    if (items.length === 0) {
      toast.error("No cargaste ningún conteo")
      return
    }

    setEnviando(true)
    try {
      const resultados = await guardarRecuentoLoteAction({
        items: items.map(({ productId, cantidadContada, motivo }) => ({ productId, cantidadContada, motivo })),
      })

      const nuevosContados = new Map(contados)
      const nuevoEnCurso = new Map(enCurso)
      let ok = 0
      let fallidos = 0
      for (const r of resultados) {
        const item = items.find((i) => i.productId === r.productId)!
        if (r.ok) {
          ok++
          nuevosContados.set(r.productId, {
            productId: r.productId,
            nombreProducto: item.producto.nombre,
            esPesable: item.producto.esPesable,
            sistemaValor: item.sistemaValor,
            contadoValor: item.cantidadContada,
          })
          nuevoEnCurso.delete(r.productId)
        } else {
          fallidos++
          toast.error(`"${item.producto.nombre}": ${r.error ?? "no se pudo guardar"}`)
        }
      }
      setContados(nuevosContados)
      setEnCurso(nuevoEnCurso)
      if (ok > 0) toast.success(`${ok} producto${ok === 1 ? "" : "s"} guardado${ok === 1 ? "" : "s"}`)
      if (fallidos === 0 && ok > 0) volver()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar el recuento")
    } finally {
      setEnviando(false)
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
  const cantidadCargada = Array.from(enCurso.values()).filter((f) => f.valor.trim() !== "").length

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

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
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
              const fila = enCurso.get(p.id)
              const yaContado = contados.get(p.id)
              const sistemaValor = p.esPesable ? (p.stockGramos ?? 0) : p.stock
              const numero = fila?.valor.trim() ? Number(fila.valor.replace(",", ".")) : null
              const contadoUnidad = numero != null && Number.isFinite(numero) ? (p.esPesable ? Math.round(numero * 1000) : Math.round(numero)) : null
              const hayFaltante = contadoUnidad != null && contadoUnidad < sistemaValor

              return (
                <div key={p.id} className="rounded-2xl border border-border/60 bg-card px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.nombre}</div>
                      <div className="text-xs text-muted-foreground">
                        Sistema: {formatearCantidad(sistemaValor, p.esPesable)}
                        {yaContado && (
                          <span className="text-k-gain"> · contado {formatearCantidad(yaContado.contadoValor, p.esPesable)}</span>
                        )}
                      </div>
                    </div>
                    <input
                      type="number"
                      step={p.esPesable ? "0.001" : "1"}
                      min="0"
                      inputMode="decimal"
                      value={fila?.valor ?? ""}
                      onChange={(e) => setValor(p.id, e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      placeholder={p.esPesable ? "kg" : "unid."}
                      className="w-24 h-10 shrink-0 rounded-xl border border-border/60 bg-background px-2.5 text-base text-right focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  {hayFaltante && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Faltante:</span>
                      <button
                        onClick={() => setMotivo(p.id, "CONSUMO")}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-lg border font-medium",
                          fila?.motivo === "CONSUMO"
                            ? "bg-foreground text-background border-foreground"
                            : "border-border/60 text-muted-foreground"
                        )}
                      >
                        Consumo
                      </button>
                      <button
                        onClick={() => setMotivo(p.id, "VENTA")}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-lg border font-medium",
                          fila?.motivo === "VENTA"
                            ? "bg-k-gain text-background border-k-gain"
                            : "border-border/60 text-muted-foreground"
                        )}
                      >
                        Venta
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {proveedorActivo && productos && productos.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-3 bg-background/95 backdrop-blur border-t border-border/60">
          <Button className="w-full h-12 gap-2" onClick={enviarTodo} disabled={enviando || cantidadCargada === 0}>
            {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Enviar todo{cantidadCargada > 0 ? ` (${cantidadCargada})` : ""}
          </Button>
        </div>
      )}

      {!proveedorActivo && listaContados.length > 0 && (
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
