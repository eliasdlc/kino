'use client';

import { isBefore, isToday, startOfToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { AlertCircle, Check } from 'lucide-react';
import type { Task } from './tasks.types';
import { parseDueDate } from './tasks.utils';

interface SystemInfo {
  id: string;
  name: string;
  color: string | null;
}

interface TaskListRowProps {
  task: Task;
  systemMap: Map<string, SystemInfo>;
  onToggle: (taskId: string) => void;
  onOpen: (task: Task) => void;
  isFocused?: boolean;
  isSelected?: boolean;
  onSelectionToggle?: (taskId: string) => void;
}

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/25',
  high:     'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25',
  medium:   'bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/25',
  low:      'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/25',
};
const PRIORITY_SHORT: Record<string, string> = {
  critical: 'CRIT', high: 'ALTA', medium: 'MED', low: 'BAJA',
};

const STATUS_BADGE: Record<string, string> = {
  backlog:  'bg-zinc-500/10 text-zinc-500',
  week:     'bg-indigo-500/15 text-indigo-400',
  today:    'bg-emerald-500/15 text-emerald-400',
  tomorrow: 'bg-amber-500/15 text-amber-400',
  done:     'bg-emerald-500/10 text-emerald-600',
  archived: 'bg-zinc-500/10 text-zinc-600',
};
const STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog', week: 'Semana', today: 'Hoy',
  tomorrow: 'Mañana', done: 'Hecho', archived: 'Archivado',
};

const ENERGY_DOT: Record<string, string> = {
  high: 'bg-amber-400', medium: 'bg-sky-400', low: 'bg-zinc-400',
};

function dueDateLabel(dueDate: string | null): { label: string; overdue: boolean } {
  if (!dueDate) return { label: '', overdue: false };
  const d = parseDueDate(dueDate);
  const overdue = isBefore(d, startOfToday());
  if (isToday(d)) return { label: 'hoy', overdue: false };
  return {
    label: d.toLocaleDateString('es', { day: 'numeric', month: 'short' }),
    overdue,
  };
}

export function TaskListRow({ task, systemMap, onToggle, onOpen, isFocused, isSelected, onSelectionToggle }: TaskListRowProps) {
  const isDone = task.status === 'done';
  const system = systemMap.get(task.systemId);
  const { label: dateLabel, overdue } = dueDateLabel(task.dueDate);

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-2 hover:bg-accent/30 transition-colors group',
        overdue && 'border-l-2 border-red-500/60',
        isDone && 'opacity-50',
        isSelected && 'bg-primary/5',
        isFocused && !isSelected && 'bg-accent/40',
        isFocused && 'ring-1 ring-inset ring-primary/30',
      )}
    >
      {/* Selection checkbox */}
      {onSelectionToggle && (
        <button
          onClick={(e) => { e.stopPropagation(); onSelectionToggle(task.id); }}
          className={cn(
            'w-4 h-4 rounded border shrink-0 transition-colors flex items-center justify-center',
            isSelected
              ? 'bg-primary border-primary text-primary-foreground'
              : 'border-border md:opacity-0 md:group-hover:opacity-100 hover:border-primary',
          )}
          aria-label={isSelected ? 'Deseleccionar' : 'Seleccionar'}
        >
          {isSelected && <Check className="w-3 h-3" />}
        </button>
      )}

      {/* Completion toggle */}
      <button
        onClick={() => onToggle(task.id)}
        className={cn(
          'w-4 h-4 rounded border shrink-0 transition-colors',
          isDone
            ? 'bg-emerald-500/30 border-emerald-500/50'
            : 'border-border hover:border-primary',
        )}
        aria-label={isDone ? 'Marcar pendiente' : 'Completar'}
      />

      {/* Title */}
      <button
        onClick={() => onOpen(task)}
        className={cn(
          'flex-1 min-w-0 text-left text-sm',
          isDone && 'line-through text-muted-foreground',
        )}
      >
        {task.title}
      </button>

      {/* Right meta */}
      <div className="flex items-center gap-2 shrink-0 text-xs">
        {/* Status */}
        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', STATUS_BADGE[task.status])}>
          {STATUS_LABEL[task.status] ?? task.status}
        </span>

        {/* Priority */}
        {task.priority && (
          <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-medium', PRIORITY_BADGE[task.priority])}>
            {PRIORITY_SHORT[task.priority]}
          </span>
        )}

        {/* System */}
        {system && (
          <span
            className="text-[11px] text-muted-foreground truncate max-w-[90px]"
            title={system.name}
          >
            {system.name}
          </span>
        )}

        {/* Energy */}
        {task.energyLevel && (
          <span className={cn('w-2 h-2 rounded-full', ENERGY_DOT[task.energyLevel])} title={`Energía ${task.energyLevel}`} />
        )}

        {/* Due date */}
        {dateLabel && (
          <span className={cn('text-[11px]', overdue ? 'text-red-400' : 'text-muted-foreground/70')}>
            {overdue && <AlertCircle className="inline w-3 h-3 mr-0.5" />}
            {dateLabel}
          </span>
        )}
      </div>
    </div>
  );
}
