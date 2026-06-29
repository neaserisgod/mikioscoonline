import { formatearARS } from "@/domain/dinero"
import { cn } from "@/lib/utils"

interface MontoDisplayProps {
  centavos: number
  className?: string
  variant?: "default" | "gain" | "loss"
  size?: "sm" | "base" | "lg" | "xl" | "2xl"
}

const sizeClasses = {
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
}

export function MontoDisplay({
  centavos,
  className,
  variant = "default",
  size = "base",
}: MontoDisplayProps) {
  return (
    <span
      className={cn(
        "tabular-nums font-medium",
        sizeClasses[size],
        variant === "gain" && "text-k-gain",
        variant === "loss" && "text-k-loss",
        className
      )}
    >
      {formatearARS(centavos)}
    </span>
  )
}
