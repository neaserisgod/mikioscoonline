"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { AbrirCajaSheet } from "@/components/pos/abrir-caja-sheet"
import { cn } from "@/lib/utils"

interface CajaConSesion {
  id: string
  nombre: string
  esPrincipal: boolean
  sesiones: { id: string }[]
}

export function CajaEstadoBar({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient()
  const [abriendo, setAbriendo] = useState<{ id: string; nombre: string } | null>(null)

  const { data: cajas } = useQuery<CajaConSesion[]>({
    queryKey: ["cajas-panel"],
    queryFn: () => fetch("/api/cajas").then((r) => r.json()),
    staleTime: 5 * 60_000,
  })

  if (!cajas) return null

  const cerradas = cajas.filter((c) => c.sesiones.length === 0)

  if (cerradas.length === 0) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", compact ? "px-0.5" : "")}>
        <span className="size-1.5 rounded-full bg-k-gain shrink-0" />
        {cajas.length > 1 ? "Cajas abiertas" : "Caja abierta"}
      </div>
    )
  }

  return (
    <>
      <div
        className={cn(
          "flex flex-col gap-2 rounded-xl border border-k-loss/30 bg-k-loss/8 px-3 py-2.5",
          compact && "px-2.5 py-2"
        )}
      >
        {cerradas.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 min-w-0 text-xs text-k-loss">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span className="truncate">{c.nombre} cerrada — no se puede vender ahí</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-lg text-xs shrink-0 border-k-loss/40 text-k-loss hover:text-k-loss"
              onClick={() => setAbriendo({ id: c.id, nombre: c.nombre })}
            >
              Abrir
            </Button>
          </div>
        ))}
      </div>

      <Sheet open={!!abriendo} onOpenChange={(v) => { if (!v) setAbriendo(null) }}>
        <SheetContent>
          {abriendo && (
            <AbrirCajaSheet
              cajaNombre={abriendo.nombre}
              cajaId={abriendo.id}
              onSuccess={() => {
                setAbriendo(null)
                qc.invalidateQueries({ queryKey: ["cajas-panel"] })
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
