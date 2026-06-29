"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface EquilibrioBarProps {
  pctAvance: number
  cubierto: boolean
  className?: string
}

export function EquilibrioBar({ pctAvance, cubierto, className }: EquilibrioBarProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Punto de equilibrio</span>
        <span className={cn("font-semibold tabular-nums", cubierto ? "text-k-gain" : "text-foreground")}>
          {pctAvance}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-border/60 overflow-hidden">
        <motion.div
          className={cn(
            "h-full rounded-full",
            cubierto ? "bg-k-gain" : "bg-foreground/40"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, pctAvance)}%` }}
          transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.1 }}
        />
      </div>
    </div>
  )
}
