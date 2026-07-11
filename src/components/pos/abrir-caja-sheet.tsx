"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { formatearARS } from "@/domain/dinero"
import { abrirCajaAction } from "@/app/actions/cajaSesion.actions"

const abrirFormSchema = z.object({ pesos: z.number().min(0) })

interface AbrirCajaSheetProps {
  cajaNombre: string
  cajaId: string
  /** Lo contado al cerrar la última sesión de esta caja, si la hay — se
   * prellena como fondo inicial para no perder saldo acumulado (ej. el saldo
   * de Mercado Pago) al reabrir. Editable: el usuario puede corregirlo. */
  fondoSugerido: number | null
  onSuccess: () => void
}

/** Contenido de apertura de caja. El caller lo envuelve en su propio <Sheet><SheetContent>. */
export function AbrirCajaSheet({ cajaNombre, cajaId, fondoSugerido, onSuccess }: AbrirCajaSheetProps) {
  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm<z.infer<typeof abrirFormSchema>>({
    resolver: zodResolver(abrirFormSchema),
    defaultValues: { pesos: (fondoSugerido ?? 0) / 100 },
  })

  async function onSubmit(data: z.infer<typeof abrirFormSchema>) {
    try {
      await abrirCajaAction(cajaId, { fondoInicialCentavos: Math.round(data.pesos * 100) })
      toast.success(`${cajaNombre} abierta`)
      onSuccess()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error al abrir") }
  }

  return (
    <>
      <SheetHeader><SheetTitle>Abrir {cajaNombre}</SheetTitle></SheetHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Fondo inicial ($)</label>
          <input
            type="number" step="0.01" min="0"
            {...register("pesos", { valueAsNumber: true })}
            placeholder="0"
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {errors.pesos && <p className="text-xs text-k-loss">{errors.pesos.message}</p>}
          {fondoSugerido !== null && (
            <p className="text-xs text-muted-foreground">
              Se contaron {formatearARS(fondoSugerido)} al cerrar la última vez — ya viene precargado, revisalo antes de confirmar.
            </p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Abrir caja"}
        </Button>
      </form>
    </>
  )
}
