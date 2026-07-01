import { Skeleton } from "@/components/ui/skeleton"

export default function ProductosLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="space-y-0 rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-48 rounded" />
            <Skeleton className="h-4 w-20 rounded ml-auto" />
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-4 w-12 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
