'use client';

import { useRef, useEffect, useState } from 'react';
import { Sparkles, RefreshCw, CalendarPlus, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { isToday, isTomorrow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSuggestedTasks, useAddToTodayPlan, useToggleTodayTask, suggestedTasksKey, type SuggestedTask } from './tasks.hooks';
import { TaskDetailSheet } from './TaskDetailSheet';
import type { Task } from './tasks.types';
import { parseDueDate } from './tasks.utils';

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 ring-red-500/25',
  high:     'bg-orange-500/15 text-orange-400 ring-orange-500/25',
  medium:   'bg-sky-500/15 text-sky-400 ring-sky-500/25',
  low:      'bg-zinc-500/15 text-zinc-400 ring-zinc-500/25',
};
const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja',
};
const ENERGY_DOT: Record<string, string> = {
  high: 'bg-amber-400', medium: 'bg-sky-400', low: 'bg-zinc-400',
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

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
  onOpen: (task: Task) => void;
}

function SuggestedRow({ task, addedIds, onAdd, onComplete, onOpen }: SuggestedRowProps) {
  const isAdded = addedIds.has(task.id) || task.inTodayPlan;
  const isDone = task.status === 'done';

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors group',
        isDone && 'opacity-50',
      )}
    >
      {/* Checkbox */}
      <button
        onClick={() => onComplete(task.id)}
        className={cn(
          'w-4 h-4 rounded border shrink-0 transition-colors',
          isDone
            ? 'bg-emerald-500/30 border-emerald-500/50'
            : 'border-border hover:border-primary',
        )}
        aria-label="Completar"
      />

      {/* Title + meta */}
      <button
        onClick={() => onOpen(task)}
        className="flex-1 min-w-0 text-left"
      >
        <span className={cn('text-sm', isDone && 'line-through text-muted-foreground')}>
          {task.title}
        </span>
        <span className="ml-2 text-xs text-muted-foreground/60">{task.why}</span>
      </button>

      {/* Badges */}
      <div className="flex items-center gap-1.5 shrink-0">
        {task.priority && (
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full ring-1 font-medium', PRIORITY_BADGE[task.priority])}>
            {PRIORITY_LABEL[task.priority]}
          </span>
        )}
        {task.dueDate && (
          <span className={cn('text-[10px] text-muted-foreground', task.dueDate < new Date().toISOString().slice(0, 10) && 'text-red-400')}>
            {dueDateLabel(task.dueDate)}
          </span>
        )}
        {task.estimatedTime != null && (
          <span className="text-[10px] text-muted-foreground/60">{formatMinutes(Number(task.estimatedTime))}</span>
        )}
        {task.energyLevel && (
          <span className={cn('w-2 h-2 rounded-full', ENERGY_DOT[task.energyLevel])} title={`Energía ${task.energyLevel}`} />
        )}
      </div>

      {/* Agregar al plan */}
      <button
        onClick={() => onAdd(task.id)}
        disabled={isAdded || isDone}
        title={isAdded ? 'Ya está en el plan de hoy' : 'Agregar al plan de hoy'}
        className={cn(
          'shrink-0 p-1 rounded transition-colors',
          isAdded
            ? 'text-emerald-500 cursor-default'
            : 'text-muted-foreground/40 hover:text-primary opacity-0 group-hover:opacity-100',
        )}
      >
        <CalendarPlus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function KinoSuggestedSection() {
  const { data: suggestions = [], isLoading, isError } = useSuggestedTasks();
  const { mutate: addToPlan } = useAddToTodayPlan();
  const { mutate: complete } = useToggleTodayTask();
  const queryClient = useQueryClient();

  // 1×/día: marca como cargado cuando llegan datos; Regenerar limpia la marca
  const cacheRef = useRef<{ dateKey: string; loaded?: boolean }>({ dateKey: '' });
  useEffect(() => {
    if (suggestions.length > 0) {
      cacheRef.current = { dateKey: todayKey() };
    }
  }, [suggestions.length]);

  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Mostrar hasta 7 tareas; excluir las que se añadieron al plan (desaparecen)
  const visible = suggestions
    .filter((t) => !addedIds.has(t.id))
    .slice(0, 7);

  function handleAdd(taskId: string) {
    addToPlan({ taskId });
    setAddedIds((prev) => new Set([...prev, taskId]));
  }

  function handleComplete(taskId: string) {
    complete({ taskId });
  }

  function handleRegenerate() {
    cacheRef.current = { dateKey: todayKey(), loaded: false };
    void queryClient.invalidateQueries({ queryKey: suggestedTasksKey() });
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-semibold">Kino sugiere para hoy</span>
        </div>
        <div className="px-4 py-3 space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 rounded bg-muted/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="w-4 h-4 shrink-0" />
        No se pudieron cargar las sugerencias.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold">Kino sugiere para hoy</span>
            <span className="text-xs text-muted-foreground">· basado en tu energía y urgencia</span>
          </div>
          <button
            onClick={handleRegenerate}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Regenerar
          </button>
        </div>

        {visible.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            {suggestions.length === 0
              ? 'No hay tareas activas para sugerir. ¡Buen trabajo!'
              : 'Todas las sugerencias ya están en tu plan de hoy.'}
          </p>
        ) : (
          <div className="divide-y divide-border/50">
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
      </div>

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
