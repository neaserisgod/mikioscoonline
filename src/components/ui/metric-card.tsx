import { cn } from "@/lib/utils"
import { formatearARS } from "@/domain/dinero"

interface MetricCardProps {
  label: string
  centavos?: number
  value?: string
  sub?: string
  variant?: "default" | "gain" | "loss"
  className?: string
}

export function MetricCard({
  label,
  centavos,
  value,
  sub,
  variant = "default",
  className,
}: MetricCardProps) {
  const displayValue = centavos !== undefined ? formatearARS(centavos) : (value ?? "—")

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-1",
        variant === "gain" && "border-k-gain/20 bg-k-gain-muted/30",
        variant === "loss" && "border-k-loss/20 bg-k-loss-muted/30",
        className
      )}
    >
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p
        className={cn(
          "text-xl font-semibold tabular-nums leading-tight",
          variant === "gain" && "text-k-gain",
          variant === "loss" && "text-k-loss"
        )}
      >
        {displayValue}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
