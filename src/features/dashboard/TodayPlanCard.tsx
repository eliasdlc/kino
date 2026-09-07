'use client';

import { useState } from 'react';
import { Coffee } from 'lucide-react';
import Link from 'next/link';
import {
  useTodayPlanTasks,
  useToggleTodayTask,
  useMoveToTomorrow,
  useRemoveFromPlan,
} from '@/features/tasks/tasks.hooks';
import { useFocusTimer } from '@/features/tasks/FocusTimerProvider';
import { Skeleton } from '@/components/ui/skeleton';
import { PlanTaskRow } from './PlanTaskRow';
import type { EnergyPlanItemTransport } from '@/features/energy/energy.planner';
import type { TaskTransport } from '@/features/tasks/tasks.types';

interface TodayPlanCardProps {
  noProfile: boolean;
  energyItems?: EnergyPlanItemTransport[];
}

// Confetti burst: 12 spans, CSS keyframes, GPU-only
function ConfettiBurst() {
  const spans = Array.from({ length: 12 }, (_, i) => ({ id: i, angle: (i / 12) * 360 }));
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {spans.map(({ id, angle }) => (
        <span
          key={id}
          className="absolute top-1/2 left-1/2 size-2 rounded-full bg-primary will-change-transform"
          style={{
            animation: `confetti-fly 700ms ease-out forwards`,
            animationDelay: `${id * 30}ms`,
            '--angle': `${angle}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function tomorrowKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  // Fecha calendario local (yyyy-MM-dd), no UTC: a las 22:00 hora local
  // toISOString() ya sería pasado mañana en UTC.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Suma de las estimaciones pendientes, como "4:15"; vacío si nadie estimó. */
export function totalEstimated(tasks: readonly TaskTransport[]): string {
  const minutes = tasks.reduce((sum, t) => {
    if (!t.estimatedTime) return sum;
    const [h = '0', m = '0'] = t.estimatedTime.split(':');
    return sum + parseInt(h, 10) * 60 + parseInt(m, 10);
  }, 0);
  if (minutes === 0) return '';
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Una línea de estado: lo que antes era una tarjeta vacía. */
function Line({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground/80">{children}</div>
  );
}

/**
 * El plan de hoy: una lista de dos niveles sin bordes entre filas más que la
 * hairline. La cabecera dice cuántas tareas y cuánto suman; el vacío y el
 * "todo hecho" son una línea, no una tarjeta.
 */
export function TodayPlanCard({ noProfile, energyItems }: TodayPlanCardProps) {
  const { data: planTasks = [], isLoading } = useTodayPlanTasks();
  const { mutate: toggle } = useToggleTodayTask();
  const { mutate: moveToTomorrow } = useMoveToTomorrow();
  const { mutate: removeFromPlan } = useRemoveFromPlan();
  const { openModeDialog } = useFocusTimer();

  const [showConfetti, setShowConfetti] = useState(false);

  const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  const pendingTasks = planTasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2));

  const doneTasks = planTasks.filter((t) => t.status === 'done');
  const totalToday = planTasks.length;
  const doneCount = doneTasks.length;
  const progressPct = totalToday > 0 ? Math.round((doneCount / totalToday) * 100) : 0;
  const allDone = pendingTasks.length === 0 && doneCount > 0;
  const isEmpty = totalToday === 0;

  function handleComplete(taskId: string) {
    const willBeAllDone = pendingTasks.filter((t) => t.id !== taskId).length === 0;
    toggle({ taskId });
    if (willBeAllDone) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 900);
    }
  }

  const energyOrderMap = new Map(energyItems?.map((item, i) => [item.task.id, i]));
  const breakBeforeIds = new Set(
    energyItems?.filter((item) => item.breakBefore).map((item) => item.task.id) ?? [],
  );

  const orderedPending = energyItems?.length
    ? [...pendingTasks].sort(
        (a, b) => (energyOrderMap.get(a.id) ?? 999) - (energyOrderMap.get(b.id) ?? 999),
      )
    : pendingTasks;

  const duration = totalEstimated(pendingTasks);
  const summary = [
    totalToday > 0 ? `${totalToday} tarea${totalToday === 1 ? '' : 's'}` : null,
    doneCount > 0 ? `${doneCount} hecha${doneCount === 1 ? '' : 's'}` : null,
    duration,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section aria-label="Plan de hoy" className="relative">
      {showConfetti && <ConfettiBurst />}

      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[1.06rem] font-bold tracking-[-0.01em]">Plan de hoy</h2>
        {summary && <span className="text-xs text-muted-foreground tabular-nums">{summary}</span>}
      </div>

      {totalToday > 0 && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-secondary" aria-hidden>
          <div className="h-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      <div className="mt-2">
        {isLoading && (
          <div className="space-y-3 py-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="grid grid-cols-[1.3rem_1fr] gap-3">
                <Skeleton className="size-[1.3rem] rounded-full" />
                <Skeleton className={i === 0 ? 'h-4 w-4/5' : i === 1 ? 'h-4 w-3/5' : 'h-4 w-2/3'} />
              </div>
            ))}
          </div>
        )}

        {!isLoading && noProfile && (
          <Line>
            Kino necesita tu perfil de energía para proponer un plan.{' '}
            <Link href="/onboarding" className="font-semibold text-primary">
              Configurarlo
            </Link>
          </Line>
        )}

        {!isLoading && !noProfile && allDone && (
          <Line>
            Todo hecho por hoy: {doneCount} tarea{doneCount === 1 ? '' : 's'}.{' '}
            <Link href="/tasks" className="font-semibold text-primary">
              Ver sugerencias
            </Link>
          </Line>
        )}

        {!isLoading && !noProfile && isEmpty && (
          <Line>
            No hay tareas en el plan de hoy.{' '}
            <Link href="/tasks" className="font-semibold text-primary">
              Ver sugerencias de Kino
            </Link>
          </Line>
        )}

        {!isLoading && !noProfile && !allDone && !isEmpty && (
          <div className="divide-y divide-border">
            {orderedPending.map((task, i) => (
              <div key={task.id}>
                {breakBeforeIds.has(task.id) && i > 0 && (
                  <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                    <Coffee className="size-3.5 shrink-0" />
                    <span>Pausa sugerida aquí</span>
                  </div>
                )}
                <PlanTaskRow
                  task={task}
                  onComplete={() => handleComplete(task.id)}
                  onMoveToTomorrow={() => moveToTomorrow({ taskId: task.id, tomorrow: tomorrowKey() })}
                  onRemove={() => removeFromPlan({ taskId: task.id })}
                  onStartTimer={() => openModeDialog({ id: task.id, title: task.title, systemId: task.systemId })}
                />
              </div>
            ))}
            {doneCount > 0 && (
              <p className="py-2.5 text-xs text-muted-foreground">
                {doneCount} hecha{doneCount === 1 ? '' : 's'} hoy
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
