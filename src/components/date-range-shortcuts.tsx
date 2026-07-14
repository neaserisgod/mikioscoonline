"use client"

import { cn } from "@/lib/utils"

// Fecha LOCAL, no UTC — toISOString() corre el día para atrás en husos
// horarios negativos (ej. Argentina) cerca de la medianoche.
function fechaLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function inicioSemana(hoy: Date): Date {
  const d = new Date(hoy)
  const diaSemana = d.getDay() // 0 = domingo
  const diff = diaSemana === 0 ? 6 : diaSemana - 1 // arranca lunes
  d.setDate(d.getDate() - diff)
  return d
}

const ATAJOS: { label: string; rango: () => { desde: string; hasta: string } }[] = [
  {
    label: "Hoy",
    rango: () => {
      const hoy = fechaLocal(new Date())
      return { desde: hoy, hasta: hoy }
    },
  },
  {
    label: "Esta semana",
    rango: () => {
      const hoy = new Date()
      return { desde: fechaLocal(inicioSemana(hoy)), hasta: fechaLocal(hoy) }
    },
  },
  {
    label: "Este mes",
    rango: () => {
      const hoy = new Date()
      return { desde: fechaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: fechaLocal(hoy) }
    },
  },
]

/** Atajos de rango de fechas — evita tipear/elegir Desde y Hasta a mano cada
 * vez para los casos más comunes (ver historial-ventas y Config > Movimientos). */
export function DateRangeShortcuts({
  onSelect, className,
}: {
  onSelect: (rango: { desde: string; hasta: string }) => void
  className?: string
}) {
  return (
    <div className={cn("flex gap-1.5", className)}>
      {ATAJOS.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={() => onSelect(a.rango())}
          className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}
