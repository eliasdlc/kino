'use client';

import { CalendarArrowUp, Play, X, Flame, Zap, Minus, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskTransport } from '@/features/tasks/tasks.types';

const PRIORITY_ICON: Record<string, React.ReactNode> = {
  critical: <Flame size={11} className="text-red-400 shrink-0" />,
  high: <Zap size={11} className="text-orange-400 shrink-0" />,
  medium: <Minus size={11} className="text-zinc-400 shrink-0" />,
  low: <Minus size={11} className="text-zinc-500/50 shrink-0" />,
};

const ENERGY_DOT: Record<string, string> = {
  high: 'bg-amber-400',
  medium: 'bg-sky-400',
  low: 'bg-zinc-500',
};

function estimatedLabel(t: string | null | undefined): string {
  if (!t) return '';
  const [h = '0', m = '0'] = t.split(':');
  const hours = parseInt(h, 10);
  const mins = parseInt(m, 10);
  if (hours > 0 && mins > 0) return `${hours}h ${mins}min`;
  if (hours > 0) return `${hours}h`;
  return `${mins}min`;
}

interface PlanTaskRowProps {
  task: TaskTransport;
  isFirst: boolean;
  onComplete: () => void;
  onMoveToTomorrow: () => void;
  onRemove: () => void;
  onStartTimer: () => void;
}

export function PlanTaskRow({
  task,
  isFirst,
  onComplete,
  onMoveToTomorrow,
  onRemove,
  onStartTimer,
}: PlanTaskRowProps) {
  const isDone = task.status === 'done';
  const dur = estimatedLabel(task.estimatedTime);

  return (
    <div
      className={cn(
        'group flex items-center gap-2.5 px-4 py-3 transition-colors',
        isFirst && !isDone && 'bg-emerald-500/5',
        isDone && 'opacity-50',
      )}
    >
      {/* Checkbox */}
      <button
        onClick={onComplete}
        className={cn(
          'shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
          isDone
            ? 'border-emerald-500 bg-emerald-500'
            : 'border-border hover:border-emerald-400',
        )}
        aria-label={isDone ? 'Deshacer' : 'Completar'}
      >
        {isDone && (
          <svg viewBox="0 0 10 8" fill="none" className="w-2.5 h-2.5">
            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Priority + Title */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {PRIORITY_ICON[task.priority] ?? PRIORITY_ICON.medium}
        <p className={cn('text-sm truncate', isDone && 'line-through text-muted-foreground')}>
          {task.title}
        </p>
      </div>

      {/* Meta: energy + duration */}
      <div className="hidden md:flex items-center gap-2 shrink-0">
        <span
          className={cn('size-2 rounded-full shrink-0', ENERGY_DOT[task.energyLevel] ?? ENERGY_DOT.medium)}
        />
        {dur && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
            <Clock className="w-3 h-3" />
            {dur}
          </span>
        )}
      </div>

      {/* Actions — visible on hover (always visible on touch) */}
      {!isDone && (
        <div className="flex items-center gap-1 shrink-0 md:opacity-0 md:group-hover:opacity-100 md:transition-opacity">
          <button
            onClick={onStartTimer}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            title="Iniciar timer"
          >
            <Play size={13} />
          </button>
          <button
            onClick={onMoveToTomorrow}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            title="Mover a mañana"
          >
            <CalendarArrowUp size={13} />
          </button>
          <button
            onClick={onRemove}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-destructive"
            title="Quitar del plan"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
