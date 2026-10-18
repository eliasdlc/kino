import { Skeleton } from "@/components/ui/skeleton";
import { PageWrapper } from "@/components/PageWrapper";
import { BreadcrumbSkeleton, RowsSkeleton } from "@/components/Skeletons";

/**
 * La forma de un sistema: las migas, la cabecera (el glifo en el margen, el
 * eyebrow, el nombre, la intención y tres cifras), las pestañas-palabra y la
 * lista de filas de la superficie que abre.
 */
export default function SystemLoading() {
  return (
    <div aria-busy className="w-full">
      <div className="sticky top-0 z-(--z-raised) hidden border-b bg-background px-4 py-2.5 md:block md:px-6">
        <BreadcrumbSkeleton segments={2} />
      </div>

      <PageWrapper className="w-full">
        <div className="grid grid-cols-[var(--margen)_1fr] md:grid-cols-[0_1fr]">
          <span className="flex justify-center self-start pt-1 md:hidden">
            <Skeleton className="size-7 rounded-md" />
          </span>
          <div className="space-y-3">
            <Skeleton className="h-3 w-44" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-full" />
            <div className="flex gap-8 pt-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-7 w-12" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Las pestañas-palabra */}
        <div className="flex gap-6 border-b border-border pb-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-4 w-16" />
          ))}
        </div>

        <RowsSkeleton rows={5} margin="circle" />
      </PageWrapper>
    </div>
  );
}
