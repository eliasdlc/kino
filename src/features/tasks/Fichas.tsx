'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * Una ficha: 48 px de alto con el dedo (el táctil mínimo) y 2rem con ratón.
 * Elegida va en tinta, como el segmento: elegir un filtro o un valor es un
 * estado, no una acción, y el ámbar es de la acción.
 */
export const FICHA =
  'press focus-ring inline-flex h-[2.85rem] items-center rounded-full border px-3.5 text-sm font-medium transition-[color,background-color,border-color,transform] duration-(--dur-toque) ease-(--ease-pluma) md:pointer-fine:h-8 md:pointer-fine:px-3 md:pointer-fine:text-xs';
export const FICHA_ON = 'border-foreground bg-foreground text-background';
export const FICHA_OFF = 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground';

export interface FichaOpcion<T extends string> {
  value: T;
  label: string;
}

interface FichasProps<T extends string> {
  /** El nombre del grupo, para el lector de pantalla. Si `rotulo` no va, se dice sólo a él. */
  label: string;
  /** El rótulo visible encima de las fichas; sin él, el grupo lo nombra quien lo contiene. */
  rotulo?: boolean;
  /** Id de un rótulo que ya existe fuera (el margen del detalle). */
  labelledBy?: string;
  options: readonly FichaOpcion<T>[];
  /** Lo elegido: una o varias. */
  selected: readonly T[];
  onToggle: (value: T) => void;
  className?: string;
}

/**
 * Un grupo de fichas con nombre (`role="group"`), cada una con `aria-pressed`.
 * Lo usan los filtros de /tasks y los campos del detalle de una tarea, para
 * que elegir prioridad, energía o carpeta se haga igual en los dos sitios y
 * nunca con un `Select` de escritorio en el teléfono.
 */
export function Fichas<T extends string>({ label, rotulo = false, labelledBy, options, selected, onToggle, className }: FichasProps<T>) {
  const id = useId();
  const nombrado = labelledBy ?? (rotulo ? id : undefined);
  return (
    <div className={cn(rotulo && 'space-y-1.5', className)}>
      {rotulo && (
        <p id={id} className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          {label}
        </p>
      )}
      <div
        role="group"
        aria-labelledby={nombrado}
        aria-label={nombrado ? undefined : label}
        className="flex flex-wrap gap-1.5"
      >
        {options.map(({ value, label: l }) => {
          const on = selected.includes(value);
          return (
            <button key={value} type="button" aria-pressed={on} onClick={() => onToggle(value)} className={cn(FICHA, on ? FICHA_ON : FICHA_OFF)}>
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}
