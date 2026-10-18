import { Skeleton } from "@/components/ui/skeleton";
import { RowsSkeleton } from "@/components/Skeletons";

/**
 * La forma del calendario. En el teléfono, la página del día: título con sus
 * tres botones, la fecha, la tira de siete días y las filas con la hora en el
 * margen. En escritorio, la columna de sin programar y la rejilla de la semana.
 */
export default function CalendarLoading() {
  return (
    <div aria-busy className="h-full">
      <div className="space-y-5 py-5 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] md:hidden">
        <div className="grid grid-cols-[var(--margen)_1fr_auto] items-center gap-y-1">
          <span />
          <Skeleton className="h-[2.115rem] w-36" />
          <div className="flex items-center gap-1">
            <Skeleton className="size-[2.85rem] rounded-full" />
            <Skeleton className="h-[2.85rem] w-16 rounded-full" />
            <Skeleton className="size-[2.85rem] rounded-full" />
          </div>
          <Skeleton className="col-start-2 col-end-4 h-4 w-44" />
        </div>
        <div className="grid grid-cols-7 gap-0.5 border-b border-border py-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="mx-auto h-[3.6rem] w-[2.85rem] rounded-full" />
          ))}
        </div>
        <RowsSkeleton rows={4} margin="numeral" />
      </div>

      <div className="hidden h-full md:flex">
        <div className="w-52 shrink-0 space-y-2 border-r border-border p-3">
          <Skeleton className="h-3 w-24" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-[2.115rem] w-36" />
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="h-10 w-14 rounded-full" />
              <Skeleton className="size-10 rounded-full" />
            </div>
            <Skeleton className="h-[3.35rem] w-44 rounded-full" />
          </div>
          <div className="grid flex-1 grid-cols-[3.3rem_repeat(7,1fr)] gap-px">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3 border-r border-border p-2">
                <Skeleton className="mx-auto h-8 w-8" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
