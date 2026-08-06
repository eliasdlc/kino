import { Skeleton } from "@/components/ui/skeleton";
import { BreadcrumbSkeleton } from "@/components/Skeletons";

export default function PlotBoardLoading() {
  return (
    <div className="w-full">
      <div className="sticky top-0 z-10 border-b bg-background px-4 py-2.5 md:px-6">
        <BreadcrumbSkeleton segments={4} />
      </div>
      <div className="space-y-6 p-4 md:p-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-56 rounded bg-white/10" />
          <Skeleton className="h-4 w-80 rounded bg-white/5" />
        </div>
        {/* Rejilla: una columna por capítulo, tarjetas dentro */}
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map((col) => (
            <div key={col} className="min-w-56 flex-1 space-y-2">
              <Skeleton className="h-4 w-32 rounded bg-white/10" />
              {Array.from({ length: col === 2 ? 3 : 2 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg bg-white/5" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
