import { Skeleton } from "@/components/ui/skeleton";
import { RowsSkeleton } from "@/components/Skeletons";

/** La forma de Tareas: el título con su acción, la sugerencia del día y la lista de filas. */
export default function TasksLoading() {
  return (
    <div aria-busy className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-5 py-5 md:px-8 md:py-6">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-[2.85rem] w-36 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <RowsSkeleton rows={6} margin="circle" />
    </div>
  );
}
