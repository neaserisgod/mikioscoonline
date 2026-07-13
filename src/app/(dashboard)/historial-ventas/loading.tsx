import { Skeleton } from "@/components/ui/skeleton"

export default function HistorialVentasLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56 rounded-lg" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-36 rounded-xl" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
