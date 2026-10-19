import { RowsSkeleton } from "@/components/Skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** El título de una sección del índice esperando, con la geometría de `IndexHead`. */
function IndexHeadSkeleton({ cola = false }: { cola?: boolean }) {
  return (
    <div className="flex min-h-[2.85rem] flex-wrap items-end justify-between gap-x-3 border-b border-input pb-[0.45rem]">
      <span className="font-display text-[1.25rem] leading-[1.15]">
        <span className="inline-block h-[0.72em] w-28 rounded-md bg-muted align-middle" />
      </span>
      {/* Las dos acciones de 48 px que bajan hasta el hairline, como en `IndexHead`. */}
      {cola && <Skeleton className="-mb-2 h-[2.85rem] w-[15rem] max-w-full rounded-full" />}
    </div>
  );
}

/**
 * Lo que una carpeta pinta debajo de su título mientras llega: el índice de
 * documentos con su título y las tareas con el suyo. Es el mismo árbol en el
 * `loading.tsx` de la ruta y en el `Suspense` de la página, así que la carpeta
 * pasa por una sola forma y el índice no baja dos veces.
 */
export function FolderBodySkeleton() {
  return (
    <div className="space-y-7">
      <div>
        <IndexHeadSkeleton cola />
        <RowsSkeleton rows={4} margin="numeral" />
      </div>
      <div>
        <IndexHeadSkeleton />
        <RowsSkeleton rows={3} margin="circle" />
      </div>
    </div>
  );
}
