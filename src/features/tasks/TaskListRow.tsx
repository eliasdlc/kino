'use client';

import { isBefore, isToday, startOfToday } from 'date-fns';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { TaskTransport } from './tasks.types';
import { parseDueDate } from './tasks.utils';
import { useSubtasks } from './tasks.hooks';

// KIN-80: compact subtask count for the global list view
function SubtaskCount({ taskId, systemId }: { taskId: string; systemId: string }) {
  const { data: subtasks } = useSubtasks(taskId, systemId);
  if (!subtasks || subtasks.length === 0) return null;
  const done = subtasks.filter((s) => s.status === 'done').length;
  return (
    <span className="tabular-nums">
      {done} de {subtasks.length} subtareas
    </span>
  );
}

interface SystemInfo {
  id: string;
  name: string;
  color: string | null;
}

interface TaskListRowProps {
  task: TaskTransport;
  systemMap: Map<string, SystemInfo>;
  onToggle: (taskId: string) => void;
  onOpen: (task: TaskTransport) => void;
  isFocused?: boolean;
  isSelected?: boolean;
  onSelectionToggle?: (taskId: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog', week: 'Semana', today: 'Hoy',
  tomorrow: 'Mañana', done: 'Hecho', archived: 'Archivado',
};

const ENERGY_LABEL: Record<string, string> = { high: 'alta', medium: 'media', low: 'baja' };

function dueDateLabel(dueDate: string | null): { label: string; overdue: boolean } {
  if (!dueDate) return { label: '', overdue: false };
  const d = parseDueDate(dueDate);
  const overdue = isBefore(d, startOfToday());
  if (isToday(d)) return { label: 'hoy', overdue: false };
  return {
    label: d.toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', ''),
    overdue,
  };
}

/**
 * La fila de la lista de tareas tiene dos niveles: el título, a dos líneas
 * como mucho, y una línea de meta con el sistema, la fecha (con "vencida"
 * delante cuando lo está), la energía y las subtareas. A la derecha, un solo
 * chip: el estado. Crítica es peso del título, no un badge ni un color.
 */
export function TaskListRow({ task, systemMap, onToggle, onOpen, isFocused, isSelected, onSelectionToggle }: TaskListRowProps) {
  const isDone = task.status === 'done';
  const system = systemMap.get(task.systemId);
  const { label: dateLabel, overdue } = dueDateLabel(task.dueDate);

  return (
    <div
      className={cn(
        'group grid grid-cols-[auto_1fr_auto] items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/40',
        isDone && 'opacity-50',
        isSelected && 'bg-primary/5',
        isFocused && !isSelected && 'bg-accent/40',
        isFocused && 'ring-1 ring-inset ring-primary/30',
      )}
    >
      <div className="flex items-center gap-2 pt-0.5">
        {onSelectionToggle && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSelectionToggle(task.id); }}
            className={cn(
              'flex size-[1.3rem] shrink-0 items-center justify-center rounded-md border-2 transition-colors',
              isSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input hover:border-primary md:opacity-0 md:group-hover:opacity-100',
            )}
            aria-label={isSelected ? 'Deseleccionar' : 'Seleccionar'}
          >
            {isSelected && <Check className="size-3" strokeWidth={3} />}
          </button>
        )}
        <button
          type="button"
          onClick={() => onToggle(task.id)}
          className={cn(
            'flex size-[1.3rem] shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            isDone ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:border-primary',
          )}
          aria-label={isDone ? 'Marcar pendiente' : 'Completar'}
        >
          {isDone && <Check className="size-3" strokeWidth={3} />}
        </button>
      </div>

      <button type="button" onClick={() => onOpen(task)} className="min-w-0 text-left">
        <p
          className={cn(
            'line-clamp-2 text-[0.95rem] leading-snug',
            task.priority === 'critical' && 'font-semibold',
            isDone && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </p>
        <p className="mt-0.5 flex flex-wrap gap-x-1.5 text-xs text-muted-foreground">
          {system && <span className="truncate">{system.name}</span>}
          {dateLabel && (
            <span>
              {system && '· '}
              {overdue ? (
                <>
                  <b className="font-semibold text-task-overdue">vencida</b> · {dateLabel}
                </>
              ) : (
                `vence ${dateLabel}`
              )}
            </span>
          )}
          {task.energyLevel && <span>· {ENERGY_LABEL[task.energyLevel] ?? task.energyLevel}</span>}
          <SubtaskCount taskId={task.id} systemId={task.systemId} />
        </p>
      </button>

      <Badge variant={isDone ? 'ok' : task.status === 'backlog' ? 'secondary' : 'default'} className="mt-0.5">
        {STATUS_LABEL[task.status] ?? task.status}
      </Badge>
    </div>
  );
}
