import { Skeleton } from "@/components/ui/skeleton";
import { RowsSkeleton } from "@/components/Skeletons";

/**
 * La forma del calendario mientras llega. En el teléfono, la página del día:
 * título con Hoy, la fecha con las dos flechas, la tira de siete días y las
 * filas con la hora en el margen. En escritorio, la columna de sin programar
 * y la rejilla de la semana. La comparten `calendar/loading.tsx` y el hueco
 * que ocupa la rejilla de escritorio mientras se carga su trozo.
 */
export function EsqueletoCalendarioTelefono() {
  return (
    <div className="space-y-5 py-5 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]">
      <div className="grid grid-cols-[var(--margen)_minmax(0,1fr)_auto] items-center gap-y-0.5">
        <span />
        <Skeleton className="h-[2.115rem] w-36" />
        <Skeleton className="h-[2.85rem] w-16 justify-self-end rounded-full" />
        <Skeleton className="col-start-2 h-4 w-44" />
        <div className="-mr-2 flex items-center">
          <Skeleton className="size-[2.85rem] rounded-full" />
          <Skeleton className="size-[2.85rem] rounded-full" />
        </div>
      </div>
      <div className="-mr-[max(1.25rem,env(safe-area-inset-right))] -ml-[max(1.25rem,env(safe-area-inset-left))] grid grid-cols-[repeat(7,minmax(2.85rem,1fr))] overflow-hidden border-b border-border px-2 py-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="mx-auto h-[3.6rem] w-[2.85rem] rounded-full" />
        ))}
      </div>
      <RowsSkeleton rows={4} margin="numeral" />
    </div>
  );
}

export function EsqueletoCalendarioEscritorio() {
  return (
    <div aria-hidden className="flex h-full w-full">
      <div className="w-56 shrink-0 space-y-3 border-r border-border p-3 pt-4">
        <Skeleton className="h-6 w-32" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5 border-b border-border pb-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
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
  );
}
