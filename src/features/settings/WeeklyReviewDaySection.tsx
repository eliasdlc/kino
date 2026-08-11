'use client';

import { CalendarClock } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WEEKDAY_ORDER, WEEKDAY_LABELS, type Weekday } from '@/features/energy/energy.ritual';
import { useUserSettings, useUpdateUserSettings } from './settings.hooks';

/**
 * Elige el día en que Kino ofrece el ritual de revisión semanal (Fase 4.4).
 *
 * El servidor vuelve a comprobar el día en la tz del usuario antes de armar el
 * reparto; esto solo decide cuál es ese día.
 */
export function WeeklyReviewDaySection() {
  const { data, isLoading } = useUserSettings();
  const { mutate, isPending } = useUpdateUserSettings();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Revisión semanal</h2>
        <p className="text-sm text-muted-foreground">
          El día en que Kino te ofrece repartir lo que quedó vencido.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <CalendarClock className="size-4 text-muted-foreground shrink-0" />
          <div className="space-y-0.5 min-w-0">
            <Label className="text-sm font-medium">Día de revisión</Label>
            <p className="text-xs text-muted-foreground">
              Ese día aparece la propuesta de reparto en tu dashboard, con el presupuesto
              de energía de cada día a la vista. Solo cambia cuándo trabajas cada tarea,
              nunca su fecha límite.
            </p>
          </div>
        </div>

        {isLoading || !data ? (
          <Skeleton className="h-9 w-[140px] rounded-md shrink-0" />
        ) : (
          <Select
            value={data.weeklyReviewDay}
            disabled={isPending}
            onValueChange={(value) => mutate({ weeklyReviewDay: value as Weekday })}
          >
            <SelectTrigger className="w-[140px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAY_ORDER.map((day) => (
                <SelectItem key={day} value={day}>
                  {WEEKDAY_LABELS[day]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
