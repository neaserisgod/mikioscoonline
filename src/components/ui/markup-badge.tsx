import { cn } from "@/lib/utils"
import { formatearARS } from "@/domain/dinero"

interface MarkupBadgeProps {
  markupBp: number
  gananciaFijaCentavos?: number  // si se pasa, muestra "+$X" con % equivalente como tooltip/secondary
  margenNegativo?: boolean
  className?: string
}

export function MarkupBadge({ markupBp, gananciaFijaCentavos, margenNegativo, className }: MarkupBadgeProps) {
  const negativo = margenNegativo ?? markupBp < 0

  if (gananciaFijaCentavos !== undefined) {
    const pct = (markupBp / 100).toFixed(1)
    return (
      <span
        title={`${markupBp >= 0 ? "+" : ""}${pct}%`}
        className={cn(
          "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
          negativo
            ? "bg-k-loss-muted text-k-loss"
            : "bg-k-gain-muted text-k-gain",
          className
        )}
      >
        {gananciaFijaCentavos >= 0 ? "+" : ""}{formatearARS(gananciaFijaCentavos)}
      </span>
    )
  }

  const pct = (markupBp / 100).toFixed(1)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
        negativo
          ? "bg-k-loss-muted text-k-loss"
          : "bg-k-gain-muted text-k-gain",
        className
      )}
    >
      {markupBp >= 0 ? "+" : ""}{pct}%
    </span>
  )
}
