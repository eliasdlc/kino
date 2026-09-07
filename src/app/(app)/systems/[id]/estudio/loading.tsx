import { Skeleton } from "@/components/ui/skeleton";
import { BreadcrumbSkeleton } from "@/components/Skeletons";

/** Copia la forma de `estudio/page.tsx`: cabecera, título y las secciones del Studio. */
export default function StudioLoading() {
  return (
    <div className="w-full">
      <div className="sticky top-0 z-(--z-raised) border-b bg-background px-4 py-2.5 md:px-6">
        <BreadcrumbSkeleton segments={3} />
      </div>
      <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-56 rounded" />
          <Skeleton className="h-4 w-80 rounded" />
        </div>
        {/* Qué escribir hoy: una lista de sugerencias con su dato de origen */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-3 w-44 rounded" />
          </div>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </section>
        {/* Huecos del codex */}
        <section className="space-y-2">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-16 rounded-lg" />
        </section>
      </div>
    </div>
  );
}
