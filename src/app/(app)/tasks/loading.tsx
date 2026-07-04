import { Skeleton } from "@/components/ui/skeleton";

export default function TasksLoading() {
  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40 rounded" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      <div className="rounded-xl border bg-card divide-y">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="size-4 rounded shrink-0" />
            <Skeleton className={`h-4 flex-1 rounded ${i % 3 === 0 ? "max-w-[40%]" : i % 2 === 0 ? "max-w-[60%]" : "max-w-[50%]"}`} />
            <Skeleton className="h-5 w-14 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
