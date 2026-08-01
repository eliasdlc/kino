'use client';

import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { useUserSettings } from '@/features/settings/settings.hooks';
import { WEEKDAY_ORDER } from './energy.ritual';
import { WeeklyRitualDialog, useWeeklyRitual } from './WeeklyRitualDialog';

/**
 * Ofrece el ritual de revisión semanal el día que el usuario eligió (Fase 4.4).
 *
 * El día se decide con los ajustes que el dashboard ya tiene en cache, y solo si
 * coincide se pide el estado del ritual: una lectura por semana en vez de una por
 * carga del dashboard. El servidor vuelve a comprobar el día en la tz del usuario,
 * así que este atajo solo decide si vale la pena preguntar.
 */
export function WeeklyRitualPrompt() {
  const { data: settings } = useUserSettings();
  const [open, setOpen] = useState(false);

  const todayWeekday = WEEKDAY_ORDER[(new Date().getDay() + 6) % 7];
  const looksLikeReviewDay = settings?.weeklyReviewDay === todayWeekday;

  const { data: ritual } = useWeeklyRitual(looksLikeReviewDay);

  const shouldOffer = looksLikeReviewDay && ritual?.isReviewDay && ritual.overdueCount > 0;
  if (!shouldOffer) return null;

  const { overdueCount, redistribution } = ritual;
  const placeable = redistribution.assignments.length;

  return (
    <>
      <div className="mb-3 flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            Revisión de la semana · {overdueCount} vencida{overdueCount !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-muted-foreground">
            {placeable === overdueCount
              ? 'Todas caben en los próximos días sin pasar tu presupuesto de energía.'
              : `${placeable} caben en los próximos días; el resto no tiene lugar esta semana.`}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
        >
          Repartir
        </button>
      </div>

      <WeeklyRitualDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
