import { Skeleton } from "@/components/ui/skeleton"

export default function RentabilidadLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-36 rounded-lg" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
