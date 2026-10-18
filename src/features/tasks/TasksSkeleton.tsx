import { Skeleton } from '@/components/ui/skeleton';
import { PageHeaderSkeleton } from '@/components/Skeletons';
import { cn } from '@/lib/utils';

/**
 * La forma de /tasks, en un módulo sin 'use client' para que la usen igual la
 * página y su `loading.tsx`: el canto, la altura de una fila y las secciones.
 * Si la página cambia de forma, cambia aquí y el esqueleto la sigue; antes el
 * esqueleto pintaba dos cards y la página filas, y el salto medía 0,52 de CLS.
 */

/** El canto de /tasks: más estrecho que Hoy, porque es una sola columna de filas. */
export const TAREAS_PAGINA =
  'mx-auto w-full max-w-3xl space-y-6 py-5 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] md:px-8 md:py-6';

/** La altura mínima de una fila de tarea con su meta: la reservan la carga y el esqueleto. */
export const LISTA_FILA_ALTO = 'min-h-[3.9rem]';

/** Las filas esperando, a la altura de las de verdad. No animan. */
export function ListaSkeleton({ filas }: { filas: number }) {
  const anchos = ['w-3/5', 'w-4/5', 'w-1/2', 'w-2/3', 'w-3/4'];
  return (
    <div aria-busy data-slot="lista-skeleton">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className={cn('grid grid-cols-[var(--margen)_1fr] items-center border-b border-border last:border-b-0', LISTA_FILA_ALTO)}>
          <span className="mx-auto size-[1.35rem] rounded-full border-[1.6px] border-input" aria-hidden />
          <div className="space-y-1.5">
            <Skeleton className={cn('h-4', anchos[i % anchos.length])} />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** El título de sección esperando: la palabra y su hairline fuerte, a la altura de `SectionHead`. */
function SectionHeadSkeleton({ width }: { width: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-input pb-[0.45rem]">
      <Skeleton className={cn('h-[1.44rem]', width)} />
      <Skeleton className="h-3.5 w-16" />
    </div>
  );
}

/**
 * /tasks esperando: el título con su voz y su acción, el segmento Lista |
 * Calendario, lo sugerido (título, presupuesto y tres filas) y todas las
 * tareas (título, herramientas y seis filas).
 */
export function TasksPageSkeleton() {
  return (
    <div aria-busy className={TAREAS_PAGINA}>
      <PageHeaderSkeleton />
      <Skeleton className="-mt-3 h-4 w-72 max-w-[calc(100%-var(--margen))] max-md:ml-(--margen)" />
      <Skeleton className="h-[3.35rem] w-[13.5rem] rounded-full max-md:ml-(--margen)" />
      <div>
        <SectionHeadSkeleton width="w-44" />
        <div className="space-y-2 py-3 pl-(--margen)">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
        <ListaSkeleton filas={3} />
      </div>
      <div>
        <SectionHeadSkeleton width="w-48" />
        <div className="py-2 pl-(--margen)">
          <Skeleton className="h-[2.85rem] w-28 rounded-full md:pointer-fine:h-10" />
        </div>
        <ListaSkeleton filas={6} />
      </div>
    </div>
  );
}
