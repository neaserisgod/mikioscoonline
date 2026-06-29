import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-12 text-center", className)}>
      {Icon && (
        <div className="rounded-2xl bg-muted/50 p-4">
          <Icon className="size-6 text-muted-foreground" />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-xs text-muted-foreground max-w-xs">{description}</p>}
      </div>
      {action}
    </div>
  )
}
