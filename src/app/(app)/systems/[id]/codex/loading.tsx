import { Skeleton } from "@/components/ui/skeleton";
import { BreadcrumbSkeleton } from "@/components/Skeletons";

/** Copia la forma de `codex/page.tsx`: cabecera, título, las pestañas y la rejilla. */
export default function CodexLoading() {
  return (
    <div className="w-full">
      <div className="sticky top-0 z-(--z-raised) border-b bg-background px-4 py-2.5 md:px-6">
        <BreadcrumbSkeleton segments={3} />
      </div>
      <div className="w-full space-y-4 p-4 md:p-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-52 rounded" />
          <Skeleton className="h-4 w-96 max-w-full rounded" />
        </div>
        {/* CodexNav: las cuatro lecturas */}
        <div className="flex items-center gap-1 border-b border-border/50 pb-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-6 w-24 rounded" />
          ))}
        </div>
        {/* Biblioteca de entidades */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
