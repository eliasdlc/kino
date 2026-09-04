'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { WEEKDAY_LABELS, type RitualAssignment } from './energy.ritual';
import { api } from '@convex/_generated/api';
import { useConvexMutation, useConvexQuery } from '@/shared/convex/hooks';

export function useWeeklyRitual(enabled = true) {
  return useConvexQuery(api.energy.weeklyRitual, {}, { enabled });
}

interface WeeklyRitualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Agrupa el reparto por día conservando el orden cronológico del backend. */
function groupByDay(assignments: RitualAssignment[]): Array<{ date: string; items: RitualAssignment[] }> {
  const groups: Array<{ date: string; items: RitualAssignment[] }> = [];
  for (const a of assignments) {
    const last = groups[groups.length - 1];
    if (last && last.date === a.date) last.items.push(a);
    else groups.push({ date: a.date, items: [a] });
  }
  return groups;
}

/**
 * El ritual de revisión semanal (Fase 4.4): las vencidas, dónde caben, confirmar.
 *
 * Se puede quitar una tarea del reparto, pero el camino corto es un solo botón:
 * el ritual sirve si se cierra en menos de un minuto.
 */
export function WeeklyRitualDialog({ open, onOpenChange }: WeeklyRitualDialogProps) {
  const { data: ritual, isLoading } = useWeeklyRitual(open);

  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const assignments = useMemo(
    () => (ritual?.redistribution.assignments ?? []).filter((a) => !excluded.has(a.taskId)),
    [ritual, excluded],
  );

  const { mutate: apply, isPending } = useConvexMutation(api.energy.applyWeeklyRitual, {
    map: () => ({ assignments: assignments.map((a) => ({ taskId: a.taskId, date: a.date })) }),
    onSuccess: (result) => {
      const n = result.applied.length;
      if (result.failed.length > 0) {
        toast.warning(`${n} reprogramada${n !== 1 ? 's' : ''}, ${result.failed.length} sin mover`, {
          description: result.failed[0]?.message,
        });
      } else {
        toast.success(`${n} tarea${n !== 1 ? 's' : ''} repartida${n !== 1 ? 's' : ''} en la semana`);
      }
      onOpenChange(false);
    },
    onError: () => toast.error('No se pudo aplicar el reparto. Intenta de nuevo.'),
  });

  const grouped = groupByDay(assignments);
  const leftovers = ritual?.redistribution.leftovers ?? [];
  const nothingToDo = !isLoading && (ritual?.overdueCount ?? 0) === 0;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Revisión de la semana</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {nothingToDo
              ? 'No tienes nada vencido. La semana arranca limpia.'
              : 'Reparto propuesto de lo vencido, respetando el presupuesto de energía de cada día. El ritual mueve la programación; tus fechas límite no se tocan.'}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {isLoading && (
          <div className="space-y-3 py-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        )}

        {!isLoading && ritual && !nothingToDo && (
          <div className="space-y-4">
            {grouped.map(({ date, items }) => {
              const day = ritual.redistribution.days.find((d) => d.date === date);
              return (
                <div key={date} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold">
                      {day ? WEEKDAY_LABELS[day.weekday] : date}
                      <span className="ml-1.5 font-normal text-muted-foreground">{date.slice(5)}</span>
                    </p>
                    {day && (
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {day.committedPoints}/{ritual.dailyLimit} pts
                      </span>
                    )}
                  </div>

                  <div className="divide-y rounded-lg border">
                    {items.map((a) => (
                      <div key={a.taskId} className="flex items-center gap-2 px-3 py-2 group">
                        <span className="flex-1 min-w-0 truncate text-sm">{a.title}</span>
                        <span className="font-mono text-[11px] tabular-nums text-muted-foreground shrink-0">
                          {a.energyPoints} pt{a.energyPoints !== 1 ? 's' : ''}
                        </span>
                        <button
                          onClick={() => setExcluded((prev) => new Set([...prev, a.taskId]))}
                          title="Dejar esta tarea fuera del reparto"
                          className="shrink-0 rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-foreground md:opacity-0 md:group-hover:opacity-100"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {leftovers.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Sin lugar esta semana
                </p>
                <div className="divide-y rounded-lg border border-amber-500/30">
                  {leftovers.map((l) => (
                    <div key={l.taskId} className="px-3 py-2">
                      <p className="truncate text-sm">{l.title}</p>
                      <p className="text-[11px] text-muted-foreground">{l.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {excluded.size > 0 && (
              <button
                onClick={() => setExcluded(new Set())}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Undo2 className="size-3" />
                Volver a incluir {excluded.size} tarea{excluded.size !== 1 ? 's' : ''}
              </button>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => apply()}
                disabled={isPending || assignments.length === 0}
              >
                <CalendarClock className="size-3.5" />
                {isPending
                  ? 'Repartiendo…'
                  : `Confirmar ${assignments.length} tarea${assignments.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
