'use client';

import { useState } from 'react';
import { Sparkles, RefreshCw, CalendarPlus, AlertCircle } from 'lucide-react';
import { isToday, isTomorrow, differenceInCalendarDays } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EnergyBudgetBar } from '@/features/energy/EnergyBudgetBar';
import { useEnergyBudget } from '@/features/energy/energy.hooks';
import { crossesLimitWith } from '@/features/energy/energy.budget';
import { useSuggestedTasks, useAddToTodayPlan, useToggleTodayTask, type SuggestedTask } from './tasks.hooks';
import { TaskDetailSheet } from './TaskDetailSheet';
import type { TaskTransport } from './tasks.types';
import { parseDueDate } from './tasks.utils';




function dueDateLabel(dueDate: string | null): string {
  if (!dueDate) return '';
  const d = parseDueDate(dueDate);
  if (isToday(d)) return 'hoy';
  if (isTomorrow(d)) return 'mañana';
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

function formatMinutes(min: number | null): string {
  if (!min) return '';
  if (min < 60) return `~${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `~${h}h ${m}m` : `~${h}h`;
}

interface SuggestedRowProps {
  task: SuggestedTask;
  addedIds: Set<string>;
  onAdd: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onOpen: (task: TaskTransport) => void;
}

function SuggestedRow({ task, addedIds, onAdd, onComplete, onOpen }: SuggestedRowProps) {
  const isAdded = addedIds.has(task.id) || task.inTodayPlan;
  const isDone = task.status === 'done';

  return (
    <div
      className={cn(
        'group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/40',
        isDone && 'opacity-50',
      )}
    >
      <button
        onClick={() => onComplete(task.id)}
        className={cn(
          'mt-0.5 size-[1.3rem] shrink-0 rounded-full border-2 transition-colors',
          isDone ? 'border-primary bg-primary' : 'border-input hover:border-primary',
        )}
        aria-label="Completar"
      />

      {/* Dos niveles: el título, y por qué con la meta debajo */}
      <button onClick={() => onOpen(task)} className="min-w-0 flex-1 text-left">
        <p
          className={cn(
            'line-clamp-2 text-[0.95rem] leading-snug',
            task.priority === 'critical' && 'font-semibold',
            isDone && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {task.why}
          {task.dueDate && (
            <>
              {' · '}
              {differenceInCalendarDays(parseDueDate(task.dueDate), new Date()) < 0 ? (
                <b className="font-semibold text-task-overdue">vencida</b>
              ) : (
                'vence'
              )}{' '}
              {dueDateLabel(task.dueDate)}
            </>
          )}
          {formatMinutes(Number(task.estimatedTime)) && <> · {formatMinutes(Number(task.estimatedTime))}</>}
        </p>
      </button>

      {/* Agregar al plan */}
      <button
        onClick={() => onAdd(task.id)}
        disabled={isAdded || isDone}
        title={isAdded ? 'Ya está en el plan de hoy' : 'Agregar al plan de hoy'}
        className={cn(
          'mt-0.5 shrink-0 rounded-full p-1.5 transition-colors',
          isAdded
            ? 'cursor-default text-task-done'
            : 'text-muted-foreground hover:text-primary',
        )}
      >
        <CalendarPlus className="size-4" />
      </button>
    </div>
  );
}

export function KinoSuggestedSection() {
  const { data: suggestions = [], isLoading, isError, refetch } = useSuggestedTasks();
  const { mutate: addToPlan } = useAddToTodayPlan();
  const { mutate: complete } = useToggleTodayTask();
  const budget = useEnergyBudget();

  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<TaskTransport | null>(null);

  // Mostrar hasta 7 tareas; excluir las que se añadieron al plan (desaparecen)
  const visible = suggestions
    .filter((t) => !addedIds.has(t.id))
    .slice(0, 7);

  function handleAdd(taskId: string) {
    // Aviso en el cruce exacto del presupuesto (D2: avisa, jamás bloquea). Solo
    // al cruzar: ya en sobregiro no se repite en cada tarea que se agregue.
    const task = suggestions.find((t) => t.id === taskId);
    if (budget && task) {
      const { crosses, overBy, next } = crossesLimitWith(budget, task);
      if (crosses) {
        toast('Este plan pasa tu presupuesto de energía', {
          description: `Quedaría en ${next}/${budget.limit} pts (+${overBy}). Nada te frena: es para que lo sepas.`,
        });
      }
    }

    addToPlan({ taskId });
    setAddedIds((prev) => new Set([...prev, taskId]));
  }

  function handleComplete(taskId: string) {
    complete({ taskId });
  }

  function handleRegenerate() {
    void refetch();
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card shadow-(--shadow)">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Sparkles className="size-4 text-primary" />
          <span className="text-[1.06rem] font-bold tracking-[-0.01em]">Sugerido para hoy</span>
        </div>
        <div className="space-y-3 px-4 py-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 rounded-md bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <AlertCircle className="w-4 h-4 shrink-0" />
        No se pudieron cargar las sugerencias.
      </div>
    );
  }

  return (
    <>
      <section aria-label="Sugerido para hoy" className="overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <span className="text-[1.06rem] font-bold tracking-[-0.01em]">Sugerido para hoy</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">· por tu energía y urgencia</span>
          </div>
          <Button size="xs" variant="ghost" onClick={handleRegenerate}>
            <RefreshCw className="size-3.5" />
            Regenerar
          </Button>
        </div>

        {/* Aceptar sugerencias es comprometer el día: el presupuesto se ve aquí mismo */}
        <div className="border-b border-border px-4 py-2.5">
          <EnergyBudgetBar />
        </div>

        {visible.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            {suggestions.length === 0
              ? 'No hay tareas activas para sugerir. ¡Buen trabajo!'
              : 'Todas las sugerencias ya están en tu plan de hoy.'}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {visible.map((task) => (
              <SuggestedRow
                key={task.id}
                task={task}
                addedIds={addedIds}
                onAdd={handleAdd}
                onComplete={handleComplete}
                onOpen={setSelectedTask}
              />
            ))}
          </div>
        )}
      </section>

      {selectedTask && (
        <TaskDetailSheet
          task={selectedTask}
          systemId={selectedTask.systemId}
          open={!!selectedTask}
          onOpenChange={(open) => { if (!open) setSelectedTask(null); }}
        />
      )}
    </>
  );
}
