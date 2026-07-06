import { Skeleton } from "@/components/ui/skeleton"

export default function HomeLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-10 w-44 rounded-lg" />
        </div>
        <div className="flex gap-4 pb-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-16 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="lg:grid lg:grid-cols-[1.55fr_1fr] lg:gap-4 space-y-4 lg:space-y-0">
        <div className="space-y-4">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
