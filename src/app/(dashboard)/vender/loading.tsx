import { Skeleton } from "@/components/ui/skeleton"

export default function VenderLoading() {
  return (
    <div className="flex gap-6">
      <div className="flex-1 space-y-4">
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
      <div className="w-72 shrink-0 space-y-4">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  )
}
