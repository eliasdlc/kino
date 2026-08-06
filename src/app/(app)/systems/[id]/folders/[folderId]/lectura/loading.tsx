import { Skeleton } from "@/components/ui/skeleton";
import { BreadcrumbSkeleton } from "@/components/Skeletons";

export default function ReadingLoading() {
  return (
    <div className="w-full">
      <div className="sticky top-0 z-10 border-b bg-background px-4 py-2.5 md:px-6">
        <BreadcrumbSkeleton segments={4} />
      </div>
      <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-48 rounded bg-white/10" />
            <Skeleton className="h-3 w-64 rounded bg-white/5" />
          </div>
          <Skeleton className="h-9 w-32 rounded-md bg-white/5" />
        </div>
        {/* Columna de lectura: líneas de texto, no cards */}
        <div className="space-y-3">
          <Skeleton className="mx-auto h-4 w-40 rounded bg-white/10" />
          {Array.from({ length: 14 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-3.5 rounded bg-white/5"
              style={{ width: i % 5 === 4 ? "62%" : "100%" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
