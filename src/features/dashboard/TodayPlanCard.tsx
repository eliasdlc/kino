'use client';

import { useState } from 'react';
import { CheckCircle2, AlertCircle, Coffee, Sparkles } from 'lucide-react';
import Link from 'next/link';
import {
  useTodayPlanTasks,
  useToggleTodayTask,
  useMoveToTomorrow,
  useRemoveFromPlan,
} from '@/features/tasks/tasks.hooks';
import { useFocusTimer } from '@/features/tasks/FocusTimerProvider';
import { PlanTaskRow } from './PlanTaskRow';
import { EnergyBudgetBar } from '@/features/energy/EnergyBudgetBar';
import type { EnergyPlanItemTransport } from '@/features/energy/energy.planner';

interface TodayPlanCardProps {
  noProfile: boolean;
  energyItems?: EnergyPlanItemTransport[];
}

// Confetti burst: 12 spans, CSS keyframes, GPU-only
function ConfettiBurst() {
  const colors = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];
  const spans = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 360;
    const color = colors[i % colors.length];
    return { id: i, angle, color };
  });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {spans.map(({ id, angle, color }) => (
        <span
          key={id}
          className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full will-change-transform"
          style={{
            background: color,
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

  // Build a set of energy-ordered IDs if energyItems are provided
  const energyOrderMap = new Map(energyItems?.map((item, i) => [item.task.id, i]));
  const breakBeforeIds = new Set(
    energyItems?.filter((item) => item.breakBefore).map((item) => item.task.id) ?? [],
  );

  const orderedPending = energyItems?.length
    ? [...pendingTasks].sort(
        (a, b) => (energyOrderMap.get(a.id) ?? 999) - (energyOrderMap.get(b.id) ?? 999),
      )
    : pendingTasks;

  return (
    <div className="rounded-xl border bg-card overflow-hidden flex flex-col h-full relative">
      {showConfetti && <ConfettiBurst />}

      {/* Header */}
      <div className="px-4 py-3.5 border-b flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-semibold text-sm">Plan de hoy</h2>
          {totalToday > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {doneCount} de {totalToday} completada{totalToday !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {totalToday > 0 && (
          <span className="text-xs font-mono font-medium text-muted-foreground tabular-nums">
            {progressPct}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      {totalToday > 0 && (
        <div className="h-0.5 w-full bg-muted shrink-0">
          <div
            className="h-full bg-emerald-500 transition-[width] duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Presupuesto de energía: lo comprometido del día, no lo producido (4.1 · D2).
          Se muestra también con el plan vacío: el momento en que saber cuánto
          cabe hoy más sirve es antes de comprometer nada, y la barra tiene un
          mensaje escrito para ese estado. `EnergyBudgetBar` ya se oculta sola
          si todavía no hay límite en cache. */}
      <div className="px-4 py-2.5 border-b shrink-0">
        <EnergyBudgetBar />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-border border-t-muted-foreground rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && noProfile && (
          <div className="flex items-start gap-3 p-4">
            <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Perfil de energía no configurado</p>
              <p className="text-xs text-muted-foreground">
                Kino necesita tu perfil para proponer un plan.
              </p>
              <Link href="/onboarding" className="text-xs text-primary hover:underline">
                Configurar perfil →
              </Link>
            </div>
          </div>
        )}

        {!isLoading && !noProfile && allDone && (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-4">
            <Sparkles className="w-8 h-8 text-emerald-500" />
            <div>
              <p className="text-sm font-semibold text-emerald-500">¡Todo listo por hoy!</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {doneCount} tarea{doneCount !== 1 ? 's' : ''} completada{doneCount !== 1 ? 's' : ''}.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Podés{' '}
              <Link href="/tasks" className="underline underline-offset-2 hover:text-foreground">
                ver más sugerencias de Kino
              </Link>
              .
            </p>
          </div>
        )}

        {!isLoading && !noProfile && isEmpty && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-4">
            <p className="text-sm text-muted-foreground">
              No hay tareas en el plan de hoy.{' '}
              <Link href="/tasks" className="underline underline-offset-2 hover:text-foreground">
                Ver sugerencias de Kino
              </Link>
              .
            </p>
          </div>
        )}

        {!isLoading && !noProfile && !allDone && !isEmpty && (
          <div className="divide-y">
            {orderedPending.map((task, i) => (
              <div key={task.id}>
                {breakBeforeIds.has(task.id) && i > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 text-xs text-muted-foreground">
                    <Coffee className="w-3 h-3 shrink-0" />
                    <span>Pausa sugerida aquí</span>
                  </div>
                )}
                <PlanTaskRow
                  task={task}
                  isFirst={i === 0}
                  onComplete={() => handleComplete(task.id)}
                  onMoveToTomorrow={() => moveToTomorrow({ taskId: task.id, tomorrow: tomorrowKey() })}
                  onRemove={() => removeFromPlan({ taskId: task.id })}
                  onStartTimer={() => openModeDialog({ id: task.id, title: task.title, systemId: task.systemId })}
                />
              </div>
            ))}

            {doneCount > 0 && (
              <div className="flex items-center gap-2.5 px-4 py-2.5 opacity-40">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  {doneCount} completada{doneCount !== 1 ? 's' : ''} hoy
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
