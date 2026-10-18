'use client';

import { Check } from 'lucide-react';
import { MarginRow } from '@/components/ui/margin-row';
import { WEEKDAY_ORDER, WEEKDAY_LABELS, type Weekday } from '@/features/energy/energy.ritual';
import { SheetLoading } from './settings-ui';
import { useBorrador } from './use-borrador';
import { useUpdateUserSettings, useUserSettings } from './settings.hooks';

const FLECHA: Record<string, 1 | -1> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

/**
 * El día de la revisión semanal, en su hoja: siete filas, la elegida con el
 * check en tinta en el margen. Tocar un día guarda y cierra, porque es una
 * sola pregunta. Es un grupo de radios de verdad: una sola parada de
 * tabulación (el día elegido) y las flechas mueven el foco y eligen, sin
 * cerrar, para poder recorrer la semana con el teclado. El servidor vuelve a
 * comprobar el día en la zona del usuario antes de armar el reparto; esto
 * sólo decide cuál es ese día.
 */
export function WeeklyReviewDaySection({ onChosen }: { onChosen?: () => void }) {
  const { data } = useUserSettings();
  const { mutate } = useUpdateUserSettings();
  const [dia, elegir] = useBorrador<Weekday>(
    data?.weeklyReviewDay,
    (weeklyReviewDay, terminado) => mutate({ weeklyReviewDay }, { onSettled: terminado }),
    0,
  );

  if (!dia) return <SheetLoading rows={7} />;

  function moverCon(event: React.KeyboardEvent, indice: number) {
    const paso = FLECHA[event.key];
    if (!paso) return;
    event.preventDefault();
    const siguiente = (indice + paso + WEEKDAY_ORDER.length) % WEEKDAY_ORDER.length;
    elegir(WEEKDAY_ORDER[siguiente]!);
    // Las siete filas son hermanas dentro del grupo, en el mismo orden.
    const hermana = event.currentTarget.parentElement?.children[siguiente];
    if (hermana instanceof HTMLElement) hermana.focus();
  }

  return (
    <div role="radiogroup" aria-label="Día de la revisión">
      {WEEKDAY_ORDER.map((day, indice) => {
        const elegido = day === dia;
        return (
          <MarginRow
            key={day}
            role="radio"
            aria-checked={elegido}
            tabIndex={elegido ? 0 : -1}
            margin={elegido ? <Check aria-hidden className="mt-[0.5rem] size-5 stroke-[2.2] text-foreground" /> : null}
            onKeyDown={(event) => moverCon(event, indice)}
            onClick={() => {
              if (!elegido) elegir(day);
              onChosen?.();
            }}
          >
            <span className={elegido ? 'font-semibold text-foreground' : 'text-body'}>{WEEKDAY_LABELS[day]}</span>
          </MarginRow>
        );
      })}
    </div>
  );
}
