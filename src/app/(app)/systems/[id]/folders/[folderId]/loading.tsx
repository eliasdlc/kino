import { PageWrapper } from "@/components/PageWrapper";
import { BreadcrumbSkeleton, PageHeaderSkeleton } from "@/components/Skeletons";
import { FolderBodySkeleton } from "@/features/notebooks/FolderSkeleton";

/**
 * La forma de una carpeta: las migas, su título con el glifo en el margen y,
 * debajo, el mismo cuerpo que la página pinta mientras llega su contenido.
 */
export default function FolderLoading() {
  return (
    <div aria-busy className="w-full">
      <div className="sticky top-0 z-(--z-raised) hidden border-b bg-background px-4 py-2.5 md:block md:px-6">
        <BreadcrumbSkeleton segments={3} />
      </div>

      <PageWrapper className="w-full">
        <div className="space-y-7">
          <PageHeaderSkeleton />
          <FolderBodySkeleton />
        </div>
      </PageWrapper>
    </div>
  );
}
