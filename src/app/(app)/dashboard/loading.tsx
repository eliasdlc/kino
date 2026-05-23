import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <Skeleton className="h-8 w-56 rounded" />
        <Skeleton className="h-4 w-44 rounded" />
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Plan de hoy — grande */}
        <div className="lg:col-span-2 lg:row-span-2 min-h-[420px]">
          <div className="rounded-xl border bg-card overflow-hidden h-full flex flex-col">
            <div className="px-4 py-4 border-b flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-3 w-32 rounded" />
              </div>
              <Skeleton className="h-4 w-8 rounded" />
            </div>
            <div className="h-1 bg-muted shrink-0" />
            <div className="flex-1 divide-y">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="size-3.5 rounded shrink-0" />
                  <Skeleton className={`h-4 flex-1 rounded ${i === 1 ? "max-w-[55%]" : i === 2 ? "max-w-[42%]" : "max-w-[48%]"}`} />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Columna derecha */}
        <div className="flex flex-col gap-4">
          {/* Energía */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-4 border-b">
              <Skeleton className="h-4 w-28 rounded" />
            </div>
            <div className="px-4 py-4 space-y-3">
              <Skeleton className="h-12 w-full rounded" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b">
            <Skeleton className="h-4 w-24 rounded" />
          </div>
          <div className="px-4 py-4 space-y-3">
            <Skeleton className="h-10 w-full rounded" />
            <Skeleton className="h-6 w-full rounded" />
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b">
            <Skeleton className="h-4 w-28 rounded" />
          </div>
          <div className="divide-y">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <Skeleton className="size-2 rounded-full shrink-0" />
                <Skeleton className={`h-4 flex-1 rounded ${i === 1 ? "max-w-[40%]" : i === 2 ? "max-w-[55%]" : "max-w-[35%]"}`} />
                <Skeleton className="size-4 rounded shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
