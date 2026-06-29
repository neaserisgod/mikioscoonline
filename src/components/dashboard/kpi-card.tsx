import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"

interface KpiCardProps {
  title: string
  value: string
  sub?: string
  icon: LucideIcon
  variant?: "default" | "warning" | "success"
}

export function KpiCard({ title, value, sub, icon: Icon, variant = "default" }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon
          className={
            variant === "warning"
              ? "size-4 text-amber-500"
              : variant === "success"
              ? "size-4 text-green-600"
              : "size-4 text-muted-foreground"
          }
        />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}
