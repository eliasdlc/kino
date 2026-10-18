import { Skeleton } from "@/components/ui/skeleton";
import { BreadcrumbSkeleton, PageHeaderSkeleton } from "@/components/Skeletons";
import { PageWrapper } from "@/components/PageWrapper";

/** Copia la forma de `codex/page.tsx`: cabecera, título, las pestañas y la rejilla. */
export default function CodexLoading() {
  return (
    <div aria-busy className="w-full">
      <div className="sticky top-0 z-(--z-raised) hidden border-b bg-background px-4 py-2.5 md:block md:px-6">
        <BreadcrumbSkeleton segments={3} />
      </div>
      <PageWrapper className="w-full">
        <PageHeaderSkeleton voz />
        {/* CodexNav: las cuatro lecturas */}
        <div className="flex items-center gap-1 border-b border-border/50 pb-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-6 w-24 rounded" />
          ))}
        </div>
        {/* Biblioteca de entidades */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </PageWrapper>
    </div>
  );
}
