'use client';

import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserSettings } from '@/features/settings/settings.hooks';
import { WEEKDAY_ORDER } from './energy.ritual';
import { WeeklyRitualDialog, useWeeklyRitual } from './WeeklyRitualDialog';

/**
 * Ofrece el ritual de revisión semanal el día que el usuario eligió (Fase 4.4),
 * como una línea de estado con su acción, no como una tarjeta.
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
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 text-sm text-foreground/80">
          <b className="font-semibold text-foreground">
            {overdueCount} vencida{overdueCount !== 1 ? 's' : ''}
          </b>
          {placeable === overdueCount
            ? ' caben esta semana sin pasar tu presupuesto.'
            : `: ${placeable} caben esta semana, el resto no tiene lugar.`}
        </p>
        <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setOpen(true)}>
          Repartir
        </Button>
      </div>

      <WeeklyRitualDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
