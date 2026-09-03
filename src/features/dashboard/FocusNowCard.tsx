'use client';

import { Zap, Play, Timer } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useTodayPlanTasks } from '@/features/tasks/tasks.hooks';
import { useFocusTimer } from '@/features/tasks/FocusTimerProvider';
import { recommendSessions, demandLabel, type TaskDemand } from './focusSessions';
import { interpretEnergy, levelColor } from './energyDisplay';
import type { EnergyPlanItemTransport } from '@/features/energy/energy.planner';

interface FocusNowCardProps {
  energyItems?: EnergyPlanItemTransport[];
  projectedCurve: number[];
}

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function FocusNowCard({ energyItems, projectedCurve }: FocusNowCardProps) {
  const { data: planTasks = [] } = useTodayPlanTasks();
  const { dispatch, state } = useFocusTimer();

  const currentHour = new Date().getHours();
  const currentEnergy =
    projectedCurve.length === 24 ? Math.round(projectedCurve[currentHour] ?? 0) : 0;
  const reading = interpretEnergy(currentEnergy);

  const pending = planTasks.filter((t) => t.status !== 'done');
  const orderMap = new Map(energyItems?.map((it, i) => [it.task.id, i] as const));
  const ordered = energyItems?.length
    ? [...pending].sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999))
    : [...pending].sort(
        (a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2),
      );
  const topTask = ordered[0] ?? null;

  const demand = (topTask?.energyLevel ?? 'medium') as TaskDemand;
  const sessions = recommendSessions(demand, currentEnergy);
  const timerActive = state.phase !== 'idle' && state.phase !== 'recap';

  const meterColor =
    currentEnergy >= 70 ? 'bg-emerald-500' : currentEnergy >= 40 ? 'bg-amber-400' : 'bg-red-400';

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

  return (
    <div className="rounded-xl border bg-card overflow-hidden flex flex-col h-full transition-[border-color,box-shadow] hover:border-foreground/15 hover:shadow-sm">
      <div className="px-4 py-2.5 border-b flex items-center gap-2 shrink-0">
        <Zap className="w-4 h-4 text-amber-500" />
        <p className="font-semibold text-sm">Enfoque ahora</p>
        <span className="ml-auto text-xs text-muted-foreground">
          Energía <span className={cn('font-semibold tabular-nums', levelColor(currentEnergy))}>{currentEnergy}</span>
        </span>
      </div>

      <div className="flex-1 min-h-0 px-4 py-3 flex flex-col">
        {timerActive ? (
          <div className="flex-1 flex items-center gap-2.5">
            <Timer className="w-4 h-4 text-primary shrink-0 animate-pulse" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">Enfocándote en “{state.taskTitle}”</p>
              <p className="text-xs text-muted-foreground">Termina la sesión para cambiar de tarea.</p>
            </div>
          </div>
        ) : topTask ? (
          <div className="flex-1 flex flex-col justify-between gap-3">
            {/* Contexto: energía actual + tarea sugerida */}
            <div className="space-y-2.5">
              <div>
                <p className="text-xs text-muted-foreground">{reading.hint}</p>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden>
                  <div
                    className={cn('h-full rounded-full transition-[width] duration-700 ease-out', meterColor)}
                    style={{ width: `${Math.max(4, currentEnergy)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-amber-500">▸</span>
                  <span className="text-sm font-medium truncate">{topTask.title}</span>
                </div>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5 pl-4">
                  {demandLabel(demand)}
                </p>
              </div>
            </div>
            {/* Acciones */}
            <div className="flex gap-2">
              {sessions.map((s, i) => (
                <button
                  key={s.key}
                  onClick={() => start(s.minutes)}
                  className={cn(
                    'flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium transition-all active:scale-95',
                    i === 0
                      ? 'border-primary bg-primary/10 text-primary hover:bg-primary/15'
                      : 'border-border text-muted-foreground hover:bg-accent/50',
                  )}
                >
                  {i === 0 && <Play className="w-3 h-3 fill-current" />}
                  {s.label} · {s.minutes} min
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-1">
            <p className="text-sm text-muted-foreground">Sin tareas pendientes en el plan.</p>
            <Link href="/tasks" className="text-xs text-primary hover:underline">
              Ver sugerencias de Kino →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
