'use client';

import { Check } from 'lucide-react';
import { MarginRow } from '@/components/ui/margin-row';
import { WEEKDAY_ORDER, WEEKDAY_LABELS, type Weekday } from '@/features/energy/energy.ritual';
import { SheetLoading } from './settings-ui';
import { useBorrador } from './use-borrador';
import { useUpdateUserSettings, useUserSettings } from './settings.hooks';

/** El día en tres letras para el valor del índice: "Dom". */
export function diaCorto(day: Weekday): string {
  return WEEKDAY_LABELS[day].slice(0, 3);
}

/**
 * El día de la revisión semanal, en su hoja: siete filas, la elegida con el
 * check en tinta en el margen. Elegir guarda y cierra, porque es una sola
 * pregunta. El servidor vuelve a comprobar el día en la zona del usuario antes
 * de armar el reparto; esto sólo decide cuál es ese día.
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

  return (
    <div role="radiogroup" aria-label="Día de la revisión">
      {WEEKDAY_ORDER.map((day) => {
        const elegido = day === dia;
        return (
          <MarginRow
            key={day}
            role="radio"
            aria-checked={elegido}
            margin={elegido ? <Check aria-hidden className="mt-[0.5rem] size-5 stroke-[2.2] text-foreground" /> : null}
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
