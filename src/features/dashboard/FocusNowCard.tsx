'use client';

import { Play, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTodayPlanTasks } from '@/features/tasks/tasks.hooks';
import { useFocusTimer } from '@/features/tasks/FocusTimerProvider';
import { recommendSessions, demandLabel, type TaskDemand } from './focusSessions';
import { SectionHead } from './SectionHead';
import type { EnergyPlanItemTransport } from '@/features/energy/energy.planner';

interface FocusNowCardProps {
  energyItems?: EnergyPlanItemTransport[];
  projectedCurve: number[];
  currentHour: number;
}

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/**
 * Enfoque ahora: la primera tarea del plan con las sesiones que le caben a la
 * energía de este momento, bajo un título con hairline y en la columna de
 * texto. Con una sesión en marcha es una línea; sin tareas pendientes no se
 * pinta, porque una sección vacía no dice nada.
 */
export function FocusNowCard({ energyItems, projectedCurve, currentHour }: FocusNowCardProps) {
  const { data: planTasks = [] } = useTodayPlanTasks();
  const { dispatch, state } = useFocusTimer();

  const currentEnergy =
    projectedCurve.length === 24 ? Math.round(projectedCurve[currentHour] ?? 0) : 0;

  const pending = planTasks.filter((t) => t.status !== 'done');
  const orderMap = new Map(energyItems?.map((it, i) => [it.task.id, i] as const));
  const ordered = energyItems?.length
    ? [...pending].sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999))
    : [...pending].sort(
        (a, b) => (PRIORITY_ORDER[a.effectivePriority] ?? 2) - (PRIORITY_ORDER[b.effectivePriority] ?? 2),
      );
  const topTask = ordered[0] ?? null;

  const demand = (topTask?.energyLevel ?? 'medium') as TaskDemand;
  const sessions = recommendSessions(demand, currentEnergy);
  const timerActive = state.phase !== 'idle' && state.phase !== 'recap';

  function start(minutes: number) {
    if (!topTask) return;
    dispatch({
      type: 'START',
      taskId: topTask.id,
      taskTitle: topTask.title,
      systemId: topTask.systemId,
      mode: 'estimated',
      estimatedMinutes: minutes,
    });
  }

  if (timerActive) {
    return (
      <div className="flex items-center gap-3 border-b border-border py-3 pl-(--margen)">
        <Timer className="size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 truncate text-sm">
          Enfocándote en <b className="font-semibold">{state.taskTitle}</b>
        </p>
        <span className="shrink-0 text-xs text-muted-foreground">termina la sesión para cambiar</span>
      </div>
    );
  }

  if (!topTask) return null;

  return (
    <section aria-label="Enfoque ahora">
      <SectionHead title="Enfoque ahora" count={`energía ${currentEnergy}`} />
      <div className="pt-3 pl-(--margen)">
        <p className="line-clamp-2 text-base leading-tight font-semibold">{topTask.title}</p>
        <p className="mt-0.5 text-[0.82rem] text-muted-foreground">{demandLabel(demand)}</p>
        <div className="mt-3 flex gap-2">
          {sessions.map((s, i) => (
            <Button
              key={s.key}
              variant={i === 0 ? 'default' : 'secondary'}
              className="flex-1 px-2"
              onClick={() => start(s.minutes)}
            >
              {i === 0 && <Play className="size-3.5 fill-current" />}
              {s.label}, {s.minutes} min
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
