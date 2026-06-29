"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusIcon, TrashIcon, CheckIcon, ArrowRightIcon, ArrowLeftIcon, SkipForwardIcon } from "lucide-react"
import {
  guardarNegocioOnboardingAction,
  guardarDatosFiscalesAction,
  guardarCategoriasOnboardingAction,
  guardarMediosPagoOnboardingAction,
  guardarProveedoresOnboardingAction,
  guardarUbicacionesOnboardingAction,
  guardarGastosFijosOnboardingAction,
  completarOnboardingAction,
} from "@/app/actions/onboarding.actions"

// ─── Types ───────────────────────────────────────────────────────────────────

type CondicionIva = "RESPONSABLE_INSCRIPTO" | "MONOTRIBUTO" | "EXENTO" | "CONSUMIDOR_FINAL"

interface CatRow { nombre: string; markupDefaultBp: number; markupDefaultTipo: "PORCENTUAL" | "FIJO"; markupDefaultFijoCentavos: number }
interface MpRow  { nombre: string; comisionBp: number; esMercadoPago: boolean }
interface NombreRow { nombre: string }
interface GastoRow { nombre: string; montoCentavos: number }

// ─── Steps definition ────────────────────────────────────────────────────────

const STEPS = [
  { id: "negocio",    label: "Negocio",         required: true  },
  { id: "fiscal",     label: "Datos fiscales",   required: false },
  { id: "categorias", label: "Categorías",       required: false },
  { id: "medios",     label: "Medios de pago",   required: false },
  { id: "proveedores",label: "Proveedores",      required: false },
  { id: "ubicaciones",label: "Ubicaciones",      required: false },
  { id: "gastos",     label: "Gastos fijos",     required: false },
  { id: "productos",  label: "Primeros productos",required: false },
] as const

// ─── Wizard ──────────────────────────────────────────────────────────────────

export function OnboardingWizard({ orgNombre }: { orgNombre: string }) {
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Step 0
  const [nombre, setNombre] = useState(orgNombre === "Mi negocio" ? "" : orgNombre)

  // Step 1
  const [cuit, setCuit] = useState("")
  const [condicionIva, setCondicionIva] = useState<CondicionIva | "">("")
  const [puntoVenta, setPuntoVenta] = useState("")
  const [stockMinimo, setStockMinimo] = useState("0")

  // Step 2 — categorías
  const [cats, setCats] = useState<CatRow[]>([
    { nombre: "", markupDefaultBp: 3000, markupDefaultTipo: "PORCENTUAL", markupDefaultFijoCentavos: 0 },
  ])

  // Step 3 — medios de pago extra
  const [medios, setMedios] = useState<MpRow[]>([
    { nombre: "", comisionBp: 0, esMercadoPago: false },
  ])

  // Step 4 — proveedores
  const [proveedores, setProveedores] = useState<NombreRow[]>([{ nombre: "" }])

  // Step 5 — ubicaciones
  const [ubicaciones, setUbicaciones] = useState<NombreRow[]>([{ nombre: "" }])

  // Step 6 — gastos fijos
  const [gastos, setGastos] = useState<GastoRow[]>([{ nombre: "", montoCentavos: 0 }])

  const totalSteps = STEPS.length
  const progress = Math.round(((step + 1) / totalSteps) * 100)
  const currentStep = STEPS[step]

  function run(fn: () => Promise<void>) {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error inesperado")
      }
    })
  }

  function skip() {
    if (step < totalSteps - 1) setStep(s => s + 1)
    else run(() => completarOnboardingAction())
  }

  function back() {
    if (step > 0) { setStep(s => s - 1); setError(null) }
  }

  function skipAll() {
    if (!nombre.trim() || nombre === "Mi negocio") {
      setStep(0)
      setError("Completá el nombre del negocio para continuar.")
      return
    }
    run(async () => {
      await guardarNegocioOnboardingAction({ nombre: nombre.trim() })
      await completarOnboardingAction()
    })
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function handleNegocio() {
    if (!nombre.trim()) { setError("El nombre del negocio es obligatorio."); return }
    run(async () => {
      await guardarNegocioOnboardingAction({ nombre: nombre.trim() })
      setStep(1)
    })
  }

  function handleFiscal() {
    run(async () => {
      await guardarDatosFiscalesAction({
        cuit: cuit || null,
        condicionIva: (condicionIva || null) as CondicionIva | null,
        puntoDeVenta: puntoVenta ? Number(puntoVenta) : null,
        stockMinimoDefault: Number(stockMinimo),
      })
      setStep(2)
    })
  }

  function handleCategorias() {
    const validas = cats.filter(c => c.nombre.trim())
    if (validas.length === 0) { skip(); return }
    run(async () => {
      await guardarCategoriasOnboardingAction({ categorias: validas })
      setStep(3)
    })
  }

  function handleMedios() {
    const validos = medios.filter(m => m.nombre.trim())
    if (validos.length === 0) { skip(); return }
    run(async () => {
      await guardarMediosPagoOnboardingAction({ medios: validos })
      setStep(4)
    })
  }

  function handleProveedores() {
    const validos = proveedores.filter(p => p.nombre.trim())
    if (validos.length === 0) { skip(); return }
    run(async () => {
      await guardarProveedoresOnboardingAction({ proveedores: validos })
      setStep(5)
    })
  }

  function handleUbicaciones() {
    const validas = ubicaciones.filter(u => u.nombre.trim())
    if (validas.length === 0) { skip(); return }
    run(async () => {
      await guardarUbicacionesOnboardingAction({ ubicaciones: validas })
      setStep(6)
    })
  }

  function handleGastos() {
    const validos = gastos.filter(g => g.nombre.trim() && g.montoCentavos > 0)
    if (validos.length === 0) { skip(); return }
    run(async () => {
      await guardarGastosFijosOnboardingAction({ gastos: validos })
      setStep(7)
    })
  }

  function handleProductos() {
    // Productos se cargan desde Productos > Nuevo en el dashboard
    run(() => completarOnboardingAction())
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-lg">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold mb-1">Configurá tu negocio</h1>
        <p className="text-muted-foreground text-sm">
          Paso {step + 1} de {totalSteps}
          {!currentStep.required && " · Opcional"}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < step ? "bg-primary" : i === step ? "bg-primary/60" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1 text-[11px] text-muted-foreground">
          {STEPS.map((s, i) => (
            <span key={s.id} className={i === step ? "text-foreground font-medium" : ""}>
              {s.label.split(" ")[0]}
            </span>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{currentStep.label}</CardTitle>
          {!currentStep.required && (
            <CardDescription>Podés completarlo ahora o hacerlo después desde Configuración.</CardDescription>
          )}
        </CardHeader>

        <CardContent>
          {error && (
            <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          {/* ── Step 0: Negocio ── */}
          {step === 0 && (
            <div className="space-y-3">
              <Label htmlFor="nombre-negocio">Nombre del negocio *</Label>
              <Input
                id="nombre-negocio"
                placeholder="Ej: Almacén El Barrio"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleNegocio()}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                También se crearán automáticamente: Caja general + medio de pago Efectivo.
              </p>
            </div>
          )}

          {/* ── Step 1: Datos fiscales ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cuit">CUIT</Label>
                <Input id="cuit" placeholder="20-12345678-9" value={cuit} onChange={e => setCuit(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Condición IVA</Label>
                <Select value={condicionIva} onValueChange={v => setCondicionIva(v as CondicionIva)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccioná condición IVA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RESPONSABLE_INSCRIPTO">Responsable Inscripto</SelectItem>
                    <SelectItem value="MONOTRIBUTO">Monotributo</SelectItem>
                    <SelectItem value="EXENTO">Exento</SelectItem>
                    <SelectItem value="CONSUMIDOR_FINAL">Consumidor Final</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pdv">Punto de venta</Label>
                  <Input id="pdv" type="number" min="1" placeholder="1" value={puntoVenta} onChange={e => setPuntoVenta(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stock-min">Stock mínimo default</Label>
                  <Input id="stock-min" type="number" min="0" value={stockMinimo} onChange={e => setStockMinimo(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Categorías ── */}
          {step === 2 && (
            <div className="space-y-3">
              {cats.map((cat, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Nombre (ej: Gaseosas)"
                      value={cat.nombre}
                      onChange={e => setCats(prev => prev.map((c, j) => j === i ? { ...c, nombre: e.target.value } : c))}
                    />
                    <div className="flex gap-2">
                      <Select
                        value={cat.markupDefaultTipo}
                        onValueChange={v => setCats(prev => prev.map((c, j) => j === i ? { ...c, markupDefaultTipo: v as "PORCENTUAL" | "FIJO" } : c))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PORCENTUAL">%</SelectItem>
                          <SelectItem value="FIJO">$ fijo</SelectItem>
                        </SelectContent>
                      </Select>
                      {cat.markupDefaultTipo === "PORCENTUAL" ? (
                        <div className="relative flex-1">
                          <Input
                            type="number" min="0" step="0.01"
                            placeholder="30.00"
                            value={cat.markupDefaultBp / 100}
                            onChange={e => setCats(prev => prev.map((c, j) => j === i ? { ...c, markupDefaultBp: Math.round(parseFloat(e.target.value || "0") * 100) } : c))}
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                        </div>
                      ) : (
                        <div className="relative flex-1">
                          <Input
                            type="number" min="0"
                            placeholder="0.00"
                            value={cat.markupDefaultFijoCentavos / 100}
                            onChange={e => setCats(prev => prev.map((c, j) => j === i ? { ...c, markupDefaultFijoCentavos: Math.round(parseFloat(e.target.value || "0") * 100) } : c))}
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {cats.length > 1 && (
                    <Button size="icon-sm" variant="ghost" onClick={() => setCats(prev => prev.filter((_, j) => j !== i))}>
                      <TrashIcon />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline" size="sm"
                onClick={() => setCats(prev => [...prev, { nombre: "", markupDefaultBp: 3000, markupDefaultTipo: "PORCENTUAL", markupDefaultFijoCentavos: 0 }])}
              >
                <PlusIcon /> Agregar categoría
              </Button>
            </div>
          )}

          {/* ── Step 3: Medios de pago extra ── */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">El medio Efectivo ya fue creado. Agregá otros si usás (ej: MercadoPago, débito).</p>
              {medios.map((mp, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    className="flex-1"
                    placeholder="Nombre (ej: MercadoPago)"
                    value={mp.nombre}
                    onChange={e => setMedios(prev => prev.map((m, j) => j === i ? { ...m, nombre: e.target.value } : m))}
                  />
                  <div className="relative w-28">
                    <Input
                      type="number" min="0" step="0.01"
                      placeholder="0.00"
                      value={mp.comisionBp / 100}
                      onChange={e => setMedios(prev => prev.map((m, j) => j === i ? { ...m, comisionBp: Math.round(parseFloat(e.target.value || "0") * 100) } : m))}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">% com.</span>
                  </div>
                  {medios.length > 1 && (
                    <Button size="icon-sm" variant="ghost" onClick={() => setMedios(prev => prev.filter((_, j) => j !== i))}>
                      <TrashIcon />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline" size="sm"
                onClick={() => setMedios(prev => [...prev, { nombre: "", comisionBp: 0, esMercadoPago: false }])}
              >
                <PlusIcon /> Agregar medio
              </Button>
            </div>
          )}

          {/* ── Step 4: Proveedores ── */}
          {step === 4 && (
            <div className="space-y-3">
              {proveedores.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Nombre del proveedor"
                    value={p.nombre}
                    onChange={e => setProveedores(prev => prev.map((x, j) => j === i ? { nombre: e.target.value } : x))}
                  />
                  {proveedores.length > 1 && (
                    <Button size="icon-sm" variant="ghost" onClick={() => setProveedores(prev => prev.filter((_, j) => j !== i))}>
                      <TrashIcon />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setProveedores(prev => [...prev, { nombre: "" }])}>
                <PlusIcon /> Agregar proveedor
              </Button>
            </div>
          )}

          {/* ── Step 5: Ubicaciones ── */}
          {step === 5 && (
            <div className="space-y-3">
              {ubicaciones.map((u, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Ej: Heladera, Estante central"
                    value={u.nombre}
                    onChange={e => setUbicaciones(prev => prev.map((x, j) => j === i ? { nombre: e.target.value } : x))}
                  />
                  {ubicaciones.length > 1 && (
                    <Button size="icon-sm" variant="ghost" onClick={() => setUbicaciones(prev => prev.filter((_, j) => j !== i))}>
                      <TrashIcon />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setUbicaciones(prev => [...prev, { nombre: "" }])}>
                <PlusIcon /> Agregar ubicación
              </Button>
            </div>
          )}

          {/* ── Step 6: Gastos fijos ── */}
          {step === 6 && (
            <div className="space-y-3">
              {gastos.map((g, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    className="flex-1"
                    placeholder="Nombre (ej: Alquiler)"
                    value={g.nombre}
                    onChange={e => setGastos(prev => prev.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))}
                  />
                  <div className="relative w-32">
                    <Input
                      type="number" min="0"
                      placeholder="0.00"
                      value={g.montoCentavos / 100}
                      onChange={e => setGastos(prev => prev.map((x, j) => j === i ? { ...x, montoCentavos: Math.round(parseFloat(e.target.value || "0") * 100) } : x))}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$/mes</span>
                  </div>
                  {gastos.length > 1 && (
                    <Button size="icon-sm" variant="ghost" onClick={() => setGastos(prev => prev.filter((_, j) => j !== i))}>
                      <TrashIcon />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setGastos(prev => [...prev, { nombre: "", montoCentavos: 0 }])}>
                <PlusIcon /> Agregar gasto
              </Button>
            </div>
          )}

          {/* ── Step 7: Primeros productos ── */}
          {step === 7 && (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Los productos se cargan mejor desde <strong>Productos → Nuevo</strong> en el dashboard, donde tenés más opciones (SKU, código de barras, stock, etc.).</p>
              <p>También podés importarlos desde un CSV.</p>
              <p className="text-foreground font-medium">¿Querés agregar productos ahora o después?</p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between gap-2">
          <div>
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={back} disabled={isPending}>
                <ArrowLeftIcon /> Atrás
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {!currentStep.required && step < totalSteps - 1 && (
              <Button variant="outline" size="sm" onClick={skip} disabled={isPending}>
                <SkipForwardIcon /> Saltar
              </Button>
            )}
            {step === totalSteps - 1 && (
              <Button variant="outline" size="sm" onClick={skip} disabled={isPending}>
                <SkipForwardIcon /> Saltar productos
              </Button>
            )}
            {step === 0 && (
              <Button onClick={handleNegocio} disabled={isPending}>
                {isPending ? "Guardando…" : <><CheckIcon /> Guardar y continuar</>}
              </Button>
            )}
            {step === 1 && (
              <Button onClick={handleFiscal} disabled={isPending}>
                {isPending ? "Guardando…" : <><ArrowRightIcon /> Continuar</>}
              </Button>
            )}
            {step === 2 && (
              <Button onClick={handleCategorias} disabled={isPending}>
                {isPending ? "Guardando…" : <><ArrowRightIcon /> Continuar</>}
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleMedios} disabled={isPending}>
                {isPending ? "Guardando…" : <><ArrowRightIcon /> Continuar</>}
              </Button>
            )}
            {step === 4 && (
              <Button onClick={handleProveedores} disabled={isPending}>
                {isPending ? "Guardando…" : <><ArrowRightIcon /> Continuar</>}
              </Button>
            )}
            {step === 5 && (
              <Button onClick={handleUbicaciones} disabled={isPending}>
                {isPending ? "Guardando…" : <><ArrowRightIcon /> Continuar</>}
              </Button>
            )}
            {step === 6 && (
              <Button onClick={handleGastos} disabled={isPending}>
                {isPending ? "Guardando…" : <><ArrowRightIcon /> Continuar</>}
              </Button>
            )}
            {step === 7 && (
              <Button onClick={handleProductos} disabled={isPending}>
                {isPending ? "Entrando…" : <><CheckIcon /> Entrar al dashboard</>}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Saltar todo */}
      <div className="mt-4 text-center">
        <button
          className="text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
          onClick={skipAll}
          disabled={isPending}
        >
          Saltar todo y entrar
        </button>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Lo saltado podés completarlo después en <strong>Configuración</strong>.
        </p>
      </div>
    </div>
  )
}
