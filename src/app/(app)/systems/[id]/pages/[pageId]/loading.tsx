import { Skeleton } from "@/components/ui/skeleton";
import { BreadcrumbSkeleton } from "@/components/Skeletons";

/**
 * La forma de un manuscrito mientras llega: en escritorio la barra de las
 * migas, y en los dos la hoja con su título en Literata y sus líneas. En el
 * teléfono no hay barra: la cabecera corrida ya lleva el camino de vuelta. El
 * panel es una hoja que se abre encima, así que no tiene columna que esperar.
 */
export default function PageEditorLoading() {
  return (
    <div aria-busy className="flex h-full flex-col overflow-hidden">
      <div className="sticky top-0 z-(--z-raised) hidden shrink-0 items-center border-b border-border bg-background px-3 py-1.5 md:flex">
        <div className="flex h-9 items-center">
          <BreadcrumbSkeleton segments={3} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-8 py-6 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] md:px-6 md:py-8">
          <div className="flex flex-col gap-4">
            {/* El alto de una línea del título: 1.76rem a interlínea 1.2. */}
            <Skeleton className="h-[2.1rem] w-2/3" />
            <div className="space-y-3 pt-2">
              {["w-full", "w-[92%]", "w-[85%]", "w-full", "w-[78%]", "w-[90%]"].map((w, i) => (
                <Skeleton key={i} className={`h-4 ${w}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
