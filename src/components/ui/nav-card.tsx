import type { LucideIcon } from "lucide-react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavCardProps {
  title: string
  sub?: string
  icon: LucideIcon
  badge?: React.ReactNode
  onClick: () => void
}

/** Card de navegación clicable (icono + título + subtítulo), con un badge
 * opcional a la derecha — usada para los niveles de Proveedores/Categorías en
 * Productos. Extraída del patrón de accesos rápidos de dashboard-client.tsx. */
export function NavCard({ title, sub, icon: Icon, badge, onClick }: NavCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group rounded-2xl bg-card shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.04] hover:bg-muted/30 transition-colors p-4",
        "flex items-center gap-3 text-left w-full"
      )}
    >
      <div className="rounded-xl bg-foreground/8 p-2.5 shrink-0">
        <Icon className="size-4 text-foreground/70" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{title}</p>
        {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
      </div>
      {badge}
      <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
    </button>
  )
}
