import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarLoading() {
  return (
    <div className="h-full flex flex-col p-6 gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48 rounded" />
        <div className="flex gap-2">
          <Skeleton className="size-9 rounded-md" />
          <Skeleton className="size-9 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-6 rounded" />
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={`d-${i}`} className="h-24 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
