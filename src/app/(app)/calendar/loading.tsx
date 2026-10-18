import { Skeleton } from "@/components/ui/skeleton";

/** La forma del calendario: el mes con sus dos flechas y la rejilla de días. */
export default function CalendarLoading() {
  return (
    <div aria-busy className="flex h-full flex-col gap-4 p-5 md:p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <div className="flex gap-2">
          <Skeleton className="size-[2.85rem] rounded-full" />
          <Skeleton className="size-[2.85rem] rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-5" />
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={`d-${i}`} className="h-16 md:h-24" />
        ))}
      </div>
    </div>
  );
}
