import { Skeleton } from "@/components/ui/skeleton";
import { BreadcrumbSkeleton, RowsSkeleton } from "@/components/Skeletons";

/** La forma de una carpeta: las migas, sus acciones, el índice de documentos y las tareas. */
export default function FolderLoading() {
  return (
    <div aria-busy className="w-full">
      <div className="sticky top-0 z-(--z-raised) hidden border-b bg-background px-4 py-2.5 md:block md:px-6">
        <BreadcrumbSkeleton segments={3} />
      </div>

      <div className="space-y-6 px-5 py-5 md:px-8 md:py-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-[2.85rem] w-32 rounded-full" />
          <Skeleton className="h-[2.85rem] w-28 rounded-full" />
        </div>

        <RowsSkeleton rows={4} margin="numeral" />

        <div className="border-t border-border" />

        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-6">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-4 w-14" />
            ))}
          </div>
          <Skeleton className="h-[2.85rem] w-36 rounded-full" />
        </div>

        <RowsSkeleton rows={4} margin="circle" />
      </div>
    </div>
  );
}
