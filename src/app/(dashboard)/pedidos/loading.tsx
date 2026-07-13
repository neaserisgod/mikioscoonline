import { Skeleton } from "@/components/ui/skeleton"

export default function PedidosLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56 rounded-lg" />
      <Skeleton className="h-9 w-64 rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
