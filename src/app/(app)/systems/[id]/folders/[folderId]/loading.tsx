import { Skeleton } from "@/components/ui/skeleton";
import { PageWrapper } from "@/components/PageWrapper";
import { BreadcrumbSkeleton, PageHeaderSkeleton, RowsSkeleton } from "@/components/Skeletons";

/**
 * La forma de una carpeta: las migas, su título con el glifo en el margen, el
 * índice de documentos con su título y las tareas debajo con el suyo.
 */
export default function FolderLoading() {
  return (
    <div aria-busy className="w-full">
      <div className="sticky top-0 z-(--z-raised) hidden border-b bg-background px-4 py-2.5 md:block md:px-6">
        <BreadcrumbSkeleton segments={3} />
      </div>

      <PageWrapper className="w-full space-y-7">
        <PageHeaderSkeleton />

        <div>
          <div className="flex items-end justify-between border-b border-input pb-[0.45rem]">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-24" />
          </div>
          <RowsSkeleton rows={4} margin="numeral" />
        </div>

        <div>
          <div className="border-b border-input pb-[0.45rem]">
            <Skeleton className="h-5 w-20" />
          </div>
          <RowsSkeleton rows={3} margin="circle" />
        </div>
      </PageWrapper>
    </div>
  );
}
