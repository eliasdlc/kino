import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Los esqueletos de Diario. Ninguno anima: un esqueleto es un tono de
 * superficie con la forma de lo que viene, y la forma es lo que evita que la
 * pantalla salte al llegar. Los `loading.tsx` los componen con la misma
 * rejilla y los mismos cantos que su página.
 */

/** Las migas: la misma forma que `PageBreadcrumb`. */
export function BreadcrumbSkeleton({ segments = 2 }: { segments?: number }) {
  return (
    <nav aria-hidden className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {Array.from({ length: segments }).map((_, i) => {
        const isLast = i === segments - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/30" />}
            <Skeleton className={cn("h-4", isLast ? "w-28" : "w-16")} />
          </span>
        );
      })}
    </nav>
  );
}

/** El título de pantalla: una línea en display, opcionalmente su voz debajo. */
export function TitleSkeleton({ voz = false }: { voz?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-40" />
      {voz && <Skeleton className="h-4 w-64 max-w-full" />}
    </div>
  );
}

/**
 * Una fila de margen esperando: lo que va en el margen (un círculo, un
 * numeral), el título y su meta, y la cola. La misma rejilla que `MarginRow`.
 */
export function MarginRowSkeleton({
  margin = "circle",
  trailing = true,
  width = "w-3/5",
}: {
  margin?: "circle" | "numeral" | "none";
  trailing?: boolean;
  width?: string;
}) {
  return (
    <div className="grid min-h-[3.4rem] w-full grid-cols-[var(--margen)_1fr_auto] items-center border-b border-border py-2 last:border-b-0">
      <span className="flex justify-center self-start pt-[0.15rem]">
        {margin === "circle" && <Skeleton className="size-6 rounded-full" />}
        {margin === "numeral" && <Skeleton className="h-4 w-3" />}
      </span>
      <span className="block min-w-0 space-y-1.5">
        <Skeleton className={cn("h-4", width)} />
        <Skeleton className="h-3 w-2/5" />
      </span>
      {trailing && <Skeleton className="ml-2.5 h-3 w-8" />}
    </div>
  );
}

/** Una lista de filas de margen con anchos que no se repiten. */
export function RowsSkeleton({ rows = 5, margin }: { rows?: number; margin?: "circle" | "numeral" | "none" }) {
  const anchos = ["w-3/5", "w-4/5", "w-1/2", "w-2/3", "w-3/4"];
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <MarginRowSkeleton key={i} margin={margin} width={anchos[i % anchos.length]} />
      ))}
    </div>
  );
}

/**
 * La fila de tarea esperando. Conserva el nombre con el que la importan las
 * pantallas de sistema y carpeta; la forma ya no es una card sino la fila de
 * margen con su círculo.
 */
export function TaskCardSkeleton() {
  return <MarginRowSkeleton margin="circle" />;
}

/** Un bloque de superficie para lo poco que sigue siendo card en escritorio. */
export function CardSkeleton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-4 rounded-xl border border-border bg-card p-5", className)}>{children}</div>;
}

/**
 * La página genérica esperando: el canto de `PageWrapper`, un título y cinco
 * filas. Es el fallback del `Suspense` del shell, para una ruta que llegue
 * sin su propio `loading.tsx`.
 */
export function PageSkeleton() {
  return (
    <div aria-busy className="w-full space-y-5 px-5 py-5 md:px-8 md:py-6">
      <TitleSkeleton />
      <RowsSkeleton rows={5} />
    </div>
  );
}
