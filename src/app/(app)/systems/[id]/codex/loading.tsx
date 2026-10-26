import { Skeleton } from "@/components/ui/skeleton";
import { BreadcrumbSkeleton, PageHeaderSkeleton, RowsSkeleton } from "@/components/Skeletons";
import { PageWrapper } from "@/components/PageWrapper";

/** Copia la forma de `codex/page.tsx`: cabecera, título, las pestañas y el índice. */
export default function CodexLoading() {
  return (
    <div aria-busy className="w-full">
      <div className="sticky top-0 z-(--z-raised) hidden border-b bg-background px-4 py-2.5 md:block md:px-6">
        <BreadcrumbSkeleton segments={3} />
      </div>
      <PageWrapper className="w-full">
        <PageHeaderSkeleton voz />
        {/* CodexNav: las cuatro lecturas como pestañas-palabra */}
        <div className="flex items-end gap-x-5 border-b border-border">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex h-[2.85rem] items-center">
              <Skeleton className="h-4 w-20 rounded" />
            </div>
          ))}
        </div>
        {/* Biblioteca: el título de la primera sección y sus filas numeradas */}
        <div>
          <div className="flex min-h-[2.85rem] items-end border-b border-input pb-[0.45rem]">
            <Skeleton className="h-5 w-28 rounded" />
          </div>
          <RowsSkeleton rows={5} margin="numeral" />
        </div>
      </PageWrapper>
    </div>
  );
}
