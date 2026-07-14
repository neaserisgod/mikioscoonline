"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Plus, Trash2, PackagePlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/ui/empty-state"
import { formatearARS, floatACentavos } from "@/domain/dinero"
import { precioDesdeCosoYMarkup, markupBpDesdeCostoYPrecio } from "@/domain/markup"
import { ingresarPedidoProveedorAction } from "@/app/actions/pedidos-proveedor.actions"

interface Proveedor {
  id: string
  nombre: string
}

interface Producto {
  id: string
  nombre: string
  sku: string
  costoCentavos: number
  precioCentavos: number
  esPesable: boolean
}

interface CajaConSesion {
  id: string
  nombre: string
  sesiones: { id: string }[]
}

interface Linea {
  key: string
  productId: string
  cantidad: string
  montoTotal: string
  /** Solo tiene valor real si precioTocado=true — si no, el precio sugerido se
   * deriva en cada render (ver costoYPrecioSugerido) para que reaccione a
   * cambios en IVA/impuestos sin quedar desactualizado. */
  precioVenta: string
  precioTocado: boolean
}

function nuevaLinea(): Linea {
  return { key: crypto.randomUUID(), productId: "", cantidad: "", montoTotal: "", precioVenta: "", precioTocado: false }
}

function num(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export default function PedidosClient() {
  const searchParams = useSearchParams()
  const providerIdParam = searchParams.get("providerId")
  const sugerir = searchParams.get("sugerir") === "1"

  const [providerId, setProviderId] = useState(providerIdParam ?? "")
  const [lineas, setLineas] = useState<Linea[]>([nuevaLinea()])
  const [ivaPesos, setIvaPesos] = useState("")
  const [otrosImpuestosPesos, setOtrosImpuestosPesos] = useState("")
  const [montoPagadoPesos, setMontoPagadoPesos] = useState("")
  const [cajaId, setCajaId] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [prefillHecho, setPrefillHecho] = useState(false)

  const { data: proveedores } = useQuery<Proveedor[]>({
    queryKey: ["proveedores"],
    queryFn: () => fetch("/api/config/proveedores").then((r) => r.json()),
    staleTime: 5 * 60_000,
  })

  // Deep-link desde /proveedores ("Sugerir pedido"): precarga producto +
  // cantidad de cada ítem en stock bajo de ese proveedor. El usuario sigue
  // teniendo que cargar cuánto pagó por cada línea — eso no se puede inferir.
  const { data: stockBajoSugerido } = useQuery<{ id: string; stock: number; stockMinimo: number }[]>({
    queryKey: ["proveedor-stock-bajo", providerIdParam],
    queryFn: () => fetch(`/api/config/proveedores/${providerIdParam}/stock-bajo`).then((r) => r.json()),
    enabled: sugerir && !!providerIdParam,
  })
  useEffect(() => {
    if (prefillHecho || !stockBajoSugerido || stockBajoSugerido.length === 0) return
    setLineas(
      stockBajoSugerido.map((p) => ({
        key: crypto.randomUUID(),
        productId: p.id,
        cantidad: String(Math.max(p.stockMinimo - p.stock, 1)),
        montoTotal: "",
        precioVenta: "",
        precioTocado: false,
      }))
    )
    setPrefillHecho(true)
    toast.info(`Precargamos ${stockBajoSugerido.length} línea${stockBajoSugerido.length === 1 ? "" : "s"} en stock bajo — completá cuánto pagaste por cada una`)
  }, [stockBajoSugerido, prefillHecho])

  const { data: productosDelProveedor } = useQuery<Producto[]>({
    queryKey: ["productos", "porProveedor", providerId],
    queryFn: () => fetch(`/api/productos?providerId=${encodeURIComponent(providerId)}`).then((r) => r.json()),
    enabled: !!providerId,
  })
  const productosDisponibles = (productosDelProveedor ?? []).filter((p) => !p.esPesable)

  const { data: cajas } = useQuery<CajaConSesion[]>({
    queryKey: ["config-cajas"],
    queryFn: () => fetch("/api/config/cajas").then((r) => r.json()),
    staleTime: 30_000,
  })
  const cajasConSesion = (cajas ?? []).filter((c) => c.sesiones.length > 0)

  function actualizarLinea(key: string, cambios: Partial<Linea>) {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...cambios } : l)))
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, nuevaLinea()])
  }

  function quitarLinea(key: string) {
    setLineas((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev))
  }

  const subtotalCentavos = lineas.reduce((s, l) => s + floatACentavos(num(l.montoTotal)), 0)
  const impuestosCentavos = floatACentavos(num(ivaPesos)) + floatACentavos(num(otrosImpuestosPesos))
  const totalCentavos = subtotalCentavos + impuestosCentavos
  const montoPagadoCentavos = floatACentavos(num(montoPagadoPesos))
  const restoCuentaCorriente = totalCentavos - montoPagadoCentavos

  /** Costo unitario final (con la porción de IVA/impuestos ya prorrateada) y el
   * precio de venta sugerido a partir de ese costo — se recalcula en cada
   * render, así que reacciona al toque a cualquier línea o a los impuestos. */
  function costoYPrecioSugerido(linea: Linea) {
    const cantidad = num(linea.cantidad)
    const montoLineaCentavos = floatACentavos(num(linea.montoTotal))
    if (cantidad <= 0 || montoLineaCentavos <= 0) return null

    const fraccion = subtotalCentavos > 0 ? montoLineaCentavos / subtotalCentavos : 0
    const impuestosLinea = Math.round(impuestosCentavos * fraccion)
    const costoUnitario = Math.round((montoLineaCentavos + impuestosLinea) / cantidad)

    const producto = productosDisponibles.find((p) => p.id === linea.productId)
    const markupActual =
      producto && producto.costoCentavos > 0
        ? markupBpDesdeCostoYPrecio(producto.costoCentavos, producto.precioCentavos)
        : 0
    const precioSugerido = precioDesdeCosoYMarkup(costoUnitario, markupActual)
    return { costoUnitario, precioSugerido }
  }

  const lineasValidas = lineas.filter((l) => l.productId && num(l.cantidad) > 0 && num(l.montoTotal) > 0)
  const puedeEnviar =
    !!providerId &&
    lineasValidas.length > 0 &&
    lineasValidas.length === lineas.length &&
    (montoPagadoCentavos === 0 || !!cajaId) &&
    montoPagadoCentavos <= totalCentavos

  async function confirmar() {
    setEnviando(true)
    try {
      const res = await ingresarPedidoProveedorAction({
        providerId,
        lineas: lineasValidas.map((l) => ({
          productId: l.productId,
          cantidad: num(l.cantidad),
          montoTotalCentavos: floatACentavos(num(l.montoTotal)),
          // Si el usuario no tocó el precio a mano, no se manda — el backend lo
          // calcula con el costo final real (incluyendo IVA/impuestos ya prorrateados).
          precioVentaCentavos: l.precioTocado && l.precioVenta ? floatACentavos(num(l.precioVenta)) : undefined,
        })),
        ivaCentavos: ivaPesos ? floatACentavos(num(ivaPesos)) : undefined,
        otrosImpuestosCentavos: otrosImpuestosPesos ? floatACentavos(num(otrosImpuestosPesos)) : undefined,
        montoPagadoCentavos,
        cajaId: montoPagadoCentavos > 0 ? cajaId : undefined,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Pedido cargado — ${formatearARS(res.totalCentavos)}`)
      setLineas([nuevaLinea()])
      setIvaPesos("")
      setOtrosImpuestosPesos("")
      setMontoPagadoPesos("")
      setCajaId("")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-medium">Pedidos a proveedores</h1>
        <p className="text-sm text-muted-foreground">Cargá lo que llegó de un proveedor: actualiza stock, costo y precio de venta.</p>
      </div>

      <div className="max-w-xs space-y-1">
        <Label>Proveedor</Label>
        <Select
          value={providerId || undefined}
          onValueChange={(v) => {
            setProviderId(v ?? "")
            setLineas([nuevaLinea()])
          }}
        >
          <SelectTrigger><SelectValue placeholder="Elegí un proveedor" /></SelectTrigger>
          <SelectContent>
            {proveedores?.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!providerId ? (
        <EmptyState icon={PackagePlus} title="Elegí un proveedor para empezar a cargar el pedido" />
      ) : (
        <>
          <div className="space-y-3">
            {lineas.map((linea) => {
              const producto = productosDisponibles.find((p) => p.id === linea.productId)
              const calculo = costoYPrecioSugerido(linea)
              const yaElegidos = new Set(lineas.filter((l) => l.key !== linea.key).map((l) => l.productId))
              return (
                <div key={linea.key} className="grid grid-cols-2 gap-2 rounded-2xl border bg-card p-3 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
                  <div className="col-span-2 space-y-1 lg:col-span-1">
                    <Label className="text-xs">Producto</Label>
                    <Select
                      value={linea.productId || undefined}
                      onValueChange={(v) => actualizarLinea(linea.key, { productId: v ?? "" })}
                    >
                      <SelectTrigger><SelectValue placeholder="Elegí un producto" /></SelectTrigger>
                      <SelectContent>
                        {productosDisponibles
                          .filter((p) => p.id === linea.productId || !yaElegidos.has(p.id))
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cantidad</Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={linea.cantidad}
                      onChange={(e) => actualizarLinea(linea.key, { cantidad: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Pagué en total ($)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={linea.montoTotal}
                      onChange={(e) => actualizarLinea(linea.key, { montoTotal: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Costo unitario (con impuestos)</Label>
                    <p className="flex h-9 items-center text-sm text-muted-foreground">
                      {producto && calculo ? formatearARS(calculo.costoUnitario) : "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Precio de venta ($)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={
                        linea.precioTocado
                          ? linea.precioVenta
                          : calculo
                            ? (calculo.precioSugerido / 100).toFixed(2)
                            : ""
                      }
                      onChange={(e) => actualizarLinea(linea.key, { precioVenta: e.target.value, precioTocado: true })}
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => quitarLinea(linea.key)} aria-label="Quitar línea">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )
            })}
            <Button variant="outline" size="sm" onClick={agregarLinea}>
              <Plus className="size-4" /> Agregar línea
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">IVA — monto ($)</Label>
                <Input type="number" min={0} step={0.01} value={ivaPesos} onChange={(e) => setIvaPesos(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Otros impuestos / cargos — monto ($)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={otrosImpuestosPesos}
                  onChange={(e) => setOtrosImpuestosPesos(e.target.value)}
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-muted-foreground">Se reparten entre las líneas en proporción a lo que pagaste por cada una.</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatearARS(subtotalCentavos)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Impuestos</span><span>{formatearARS(impuestosCentavos)}</span></div>
              <div className="flex justify-between font-medium"><span>Total del pedido</span><span>{formatearARS(totalCentavos)}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Pagás ahora ($)</Label>
                <button
                  type="button"
                  className="text-xs text-primary underline"
                  onClick={() => setMontoPagadoPesos((totalCentavos / 100).toString())}
                >
                  Pagar todo
                </button>
              </div>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={montoPagadoPesos}
                onChange={(e) => setMontoPagadoPesos(e.target.value)}
                placeholder="0 = todo a cuenta corriente"
              />
            </div>
            {montoPagadoCentavos > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Caja de la que sale la plata</Label>
                <Select value={cajaId || undefined} onValueChange={(v) => setCajaId(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Elegí una caja" /></SelectTrigger>
                  <SelectContent>
                    {cajasConSesion.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {cajasConSesion.length === 0 && (
                  <p className="text-xs text-destructive">No hay ninguna caja con sesión abierta.</p>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground sm:col-span-2">
              {restoCuentaCorriente > 0
                ? `Queda ${formatearARS(restoCuentaCorriente)} a cuenta corriente del proveedor.`
                : "Se paga el total — no queda nada a cuenta corriente."}
            </p>
          </div>

          <Button onClick={confirmar} disabled={!puedeEnviar || enviando}>
            {enviando ? "Guardando..." : "Confirmar pedido"}
          </Button>
        </>
      )}
    </div>
  )
}
