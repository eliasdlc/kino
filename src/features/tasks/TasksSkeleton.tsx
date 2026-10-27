import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/PageWrapper';
import { SectionHead } from '@/features/dashboard/SectionHead';
import { cn } from '@/lib/utils';

/**
 * La forma de /tasks, en un módulo sin 'use client' para que la usen igual la
 * página y su `loading.tsx`: el canto, la cabecera con su voz, la altura de
 * una fila y las secciones. Si la página cambia de forma, cambia aquí y el
 * esqueleto la sigue; antes el esqueleto pintaba dos cards y la página filas,
 * y el salto medía 0,52 de CLS.
 *
 * Lo que es fijo (el título, la voz, el segmento, los títulos de sección) no
 * se imita con barras grises: se pinta igual, con el mismo componente y la
 * misma frase, así que mide lo mismo por construcción. Sólo lo que depende de
 * los datos (las filas, el presupuesto, las cuentas) espera en gris, a la
 * altura que tendrá.
 */

/** El canto de /tasks: el papel con su margen. El ancho lo pone la columna. */
export const TAREAS_PAGINA =
  'w-full space-y-6 py-5 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] md:px-8 md:py-6';

/**
 * La columna de Lista: más estrecha que Hoy, porque es una sola columna de
 * filas. La cabecera va siempre en ella, también en Calendario, para que el
 * título y el segmento no cambien de sitio al pasar de una vista a otra.
 */
export const TAREAS_COLUMNA = 'mx-auto w-full max-w-3xl';

/**
 * La altura de una fila de tarea con su meta: la reservan la carga y el
 * esqueleto. Calibrada con las filas de verdad a 393 px, donde el título y la
 * meta suelen ir a dos líneas cada uno (unos 5 rem); con una línea de cada uno
 * la fila mide lo mismo, porque la altura es un mínimo.
 */
export const LISTA_FILA_ALTO = 'min-h-[3.9rem]';

/** La voz bajo el título, una por vista. La misma clase en la página y en el esqueleto. */
export const VOZ_TAREAS = '-mt-3 pl-(--margen) font-voice text-base leading-snug text-body italic md:pl-0';
export const VOZ_LISTA = 'Lo sugerido sale de tu energía de hoy y de lo que vence.';

/** Las filas esperando, a la altura de las de verdad. No animan. */
export function ListaSkeleton({ filas }: { filas: number }) {
  const anchos = ['w-3/5', 'w-4/5', 'w-1/2', 'w-2/3', 'w-3/4'];
  return (
    <div aria-busy data-slot="lista-skeleton">
      {Array.from({ length: filas }).map((_, i) => (
        <div
          key={i}
          data-slot="lista-skeleton-fila"
          className={cn('grid grid-cols-[var(--margen)_1fr] items-center border-b border-border last:border-b-0', LISTA_FILA_ALTO)}
        >
          <span className="mx-auto size-[1.35rem] rounded-full border-[1.6px] border-input" aria-hidden />
          <div className="space-y-1.5 py-2">
            <Skeleton className={cn('h-4', anchos[i % anchos.length])} />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * El renglón del presupuesto de energía esperando, a su altura real (4,5 rem:
 * el canto, la línea de la cifra, la barra y la frase de debajo). Lo usa la
 * sección de lo sugerido mientras el presupuesto no se sabe, para que la
 * barra no aparezca empujando las filas.
 */
export function PresupuestoSkeleton() {
  return (
    <div aria-hidden data-slot="presupuesto-skeleton" className="h-[4.5rem] py-3 pl-(--margen)">
      <div className="flex h-4 items-center justify-between">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-3 w-12" />
      </div>
      <Skeleton className="mt-1.5 h-1.5 w-full rounded-full" />
      <Skeleton className="mt-[0.4rem] h-3 w-44" />
    </div>
  );
}

/**
 * Lo de debajo del segmento en Lista, esperando: lo sugerido (su título, el
 * presupuesto y cinco filas) y todas las tareas (su título, las herramientas y
 * seis filas). Vencidas no guarda sitio: sin vencidas no se pinta, que es lo
 * común, y un hueco de más haría encoger la página al cargar. La página lo
 * pinta igual mientras sus suscripciones llegan, y cambia a la lista de verdad
 * de una vez: nada que ya estuviera en pantalla se mueve.
 */
export function ListaDeTareasSkeleton() {
  return (
    <div aria-busy data-slot="lista-de-tareas-skeleton" className="space-y-6">
      <div>
        <SectionHead title="Sugerido para hoy" count={<Skeleton className="inline-block h-3.5 w-16 align-middle" />} />
        <PresupuestoSkeleton />
        <ListaSkeleton filas={5} />
      </div>
      <div>
        <SectionHead title="Todas las tareas" />
        <div className="flex items-center gap-2.5 py-2 pl-(--margen)">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-[2.85rem] w-28 rounded-full md:pointer-fine:h-10" />
        </div>
        <ListaSkeleton filas={6} />
      </div>
    </div>
  );
}

/**
 * La cabecera de /tasks: el título, la acción de escritorio y la voz. La
 * acción llega de fuera (la página pasa el botón; el esqueleto, su hueco),
 * porque abrir el alta es cosa del cliente.
 */
export function TareasCabecera({ accion, voz }: { accion: React.ReactNode; voz: React.ReactNode }) {
  return (
    <>
      {/* La acción va fuera de PageHeader: en el teléfono crear es el orbe del
          pie, y un hueco de acciones vacío dejaría un salto bajo el título. */}
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Tareas" />
        <div className="shrink-0 max-md:hidden">{accion}</div>
      </div>
      {/* La voz también va fuera: dentro de PageHeader, junto a una acción, su
          bloque no crece y la frase se parte palabra por palabra en escritorio. */}
      <p className={VOZ_TAREAS}>{voz}</p>
    </>
  );
}

/**
 * /tasks esperando: la cabecera de verdad (título y voz), el hueco de la
 * acción a la altura del botón, el segmento Lista | Calendario y la lista.
 */
export function TasksPageSkeleton() {
  return (
    <div aria-busy className={TAREAS_PAGINA}>
      <div className={cn(TAREAS_COLUMNA, 'space-y-6')}>
        <TareasCabecera accion={<Skeleton className="h-[2.85rem] w-[9.4rem] rounded-full" />} voz={VOZ_LISTA} />
        <Skeleton className="h-[3.35rem] w-[13.5rem] rounded-full max-md:ml-(--margen)" />
        <ListaDeTareasSkeleton />
      </div>
    </div>
  );
}
