import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * El canto de la página de Hoy: el de `PageWrapper` (1.25rem más el área
 * segura de cada lado en el teléfono, 2rem desde md), con menos aire arriba
 * porque la fecha ya trae su propio blanco de 2.85rem. Lo comparten la página
 * y su esqueleto, para que el paso de uno a otra no mueva el borde.
 */
export const HOY_PAGE =
  'mx-auto max-w-6xl pt-3 pb-6 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] md:px-8 md:py-6';

/** Las dos columnas de escritorio: la energía a la izquierda, el plan a la derecha. */
export const HOY_COLUMNS = 'md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] md:gap-10';

/** La columna de la energía, con su filete a la derecha en escritorio. */
export const HOY_ENERGY_COLUMN = 'md:border-r md:border-border md:pr-10';

/** La columna del plan: bajo la energía en el teléfono, a su lado en escritorio. */
export const HOY_PLAN_COLUMN = 'mt-8 flex flex-col gap-8 md:mt-0';

/**
 * Filas de margen del plan esperando: el círculo de 1.35rem en el margen (el
 * aro del círculo de completar), el título y su meta. La misma rejilla y el
 * mismo alto mínimo que `MarginRow`, así que la fila real cae en su sitio.
 */
export function PlanRowsSkeleton({ rows = 3 }: { rows?: number }) {
  const anchos = ['w-4/5', 'w-3/5', 'w-2/3', 'w-1/2'];
  return (
    <div aria-busy data-slot="plan-rows-skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="grid min-h-[3.4rem] grid-cols-[var(--margen)_1fr] items-center border-b border-border last:border-b-0"
        >
          <div className="flex justify-center">
            <Skeleton data-slot="plan-circle" className="size-[1.35rem] rounded-full" />
          </div>
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
 * Una línea de texto esperando con el alto de su renglón: el tamaño de letra
 * va en el contenedor, así que el renglón mide lo mismo que el de la página.
 */
function Renglon({ text, className }: { text: string; className: string }) {
  return (
    <div className={text}>
      <Skeleton className={cn('inline-block h-[0.8em] align-middle', className)} />
    </div>
  );
}

/**
 * Hoy esperando, con la forma de Hoy: la fecha, la cota (la cifra a 4.4rem,
 * la palabra del h1 y sus renglones), la curva con su renglón de horas y su
 * leyenda, el segmento del tramo y la pastilla de registrar a su alto real,
 * la barra del presupuesto, y el plan con su título sobre hairline y tres
 * filas de margen. Los altos salen de las mismas clases que la página.
 * Quieto: un esqueleto no late.
 */
export function HoySkeleton() {
  return (
    <div aria-busy data-slot="hoy-skeleton" className={HOY_PAGE}>
      <div className={HOY_COLUMNS}>
        <div className={HOY_ENERGY_COLUMN}>
          <div className="flex flex-col gap-4">
            {/* La fecha: el enlace al calendario mide 2.85rem */}
            <div className="flex min-h-[2.85rem] items-center">
              <Skeleton className="h-3 w-44" />
            </div>

            {/* La cota: cifra y palabra en el mismo renglón. Dos dígitos de
                Bricolage 800 a 4.4rem miden unos 5.2rem de ancho; la palabra
                es un renglón, y la frase y el origen ocupan dos cada uno en el
                teléfono y uno en escritorio, como en la página. */}
            <div className="grid grid-cols-[auto_1fr] items-center gap-4">
              <Skeleton data-slot="cota-skeleton" className="h-[3.8rem] w-[5.2rem] rounded-md" />
              <div data-slot="cota-texto-skeleton" className="min-w-0">
                <Skeleton className="h-[1.37rem] w-3/4" />
                <Renglon text="mt-1 text-[0.98rem] leading-[1.35]" className="w-full" />
                <Renglon text="text-[0.98rem] leading-[1.35] md:hidden" className="w-1/2" />
                <Renglon text="mt-1.5 text-[0.78rem]" className="w-full" />
                <Renglon text="text-[0.78rem] md:hidden" className="w-1/3" />
              </div>
            </div>

            {/* La curva: 3rem de barras, su renglón de horas y la leyenda */}
            <div className="space-y-1.5 pl-(--margen)">
              <div>
                <Skeleton data-slot="curva-skeleton" className="h-12 w-full rounded-sm" />
                <div className="mt-1 h-[0.7rem]" />
              </div>
              <Renglon text="text-[0.74rem]" className="w-3/5" />
            </div>

            {/* El segmento del tramo (2.85rem más su canto) y la pastilla de registrar */}
            <Skeleton data-slot="segmento-skeleton" className="h-[3.35rem] w-full rounded-full" />
            <Skeleton data-slot="registrar-skeleton" className="h-[3.2rem] w-full rounded-full" />

            {/* El presupuesto: rótulo, barra fina y frase */}
            <div className="pt-2 pl-(--margen)">
              <Renglon text="text-xs" className="w-2/5" />
              <Skeleton className="mt-1.5 h-1.5 w-full rounded-full" />
              <Renglon text="mt-1 text-xs" className="w-3/5" />
            </div>
          </div>
        </div>

        <div className={HOY_PLAN_COLUMN}>
          <div>
            {/* El título de sección: la palabra en display sobre su hairline */}
            <div data-slot="plan-head-skeleton" className="flex items-baseline justify-between gap-3 border-b border-input pb-[0.45rem]">
              <Renglon text="text-[1.25rem] leading-[1.15]" className="w-32" />
              <Skeleton className="h-3 w-16" />
            </div>
            <PlanRowsSkeleton rows={3} />
          </div>
        </div>
      </div>
    </div>
  );
}
