import { Skeleton } from "@/components/ui/skeleton";
import { BreadcrumbSkeleton, PageHeaderSkeleton } from "@/components/Skeletons";
import { PageWrapper } from "@/components/PageWrapper";

/** Copia la forma de `estudio/page.tsx`: cabecera, título y las secciones del Studio. */
export default function StudioLoading() {
  return (
    <div aria-busy className="w-full">
      <div className="sticky top-0 z-(--z-raised) hidden border-b bg-background px-4 py-2.5 md:block md:px-6">
        <BreadcrumbSkeleton segments={3} />
      </div>
      <PageWrapper className="w-full max-w-3xl">
        <PageHeaderSkeleton voz />
        {/* Qué escribir hoy: una lista de sugerencias con su dato de origen */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-3 w-44 rounded" />
          </div>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </section>
        {/* Huecos del codex */}
        <section className="space-y-2">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-16 rounded-xl" />
        </section>
      </PageWrapper>
    </div>
  );
}
