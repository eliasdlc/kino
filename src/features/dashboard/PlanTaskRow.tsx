'use client';

import { CalendarArrowUp, Check, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TaskTransport } from '@/features/tasks/tasks.types';

const ENERGY_LABEL: Record<string, string> = { high: 'alta', medium: 'media', low: 'baja' };

/** "2:30" para 02:30:00, "0:45" para 00:45; vacío si no hay estimación. */
export function estimatedLabel(t: string | null | undefined): string {
  if (!t) return '';
  const [h = '0', m = '0'] = t.split(':');
  return `${parseInt(h, 10)}:${m.padStart(2, '0')}`;
}

/** "1 sept", en la zona del dispositivo. */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '');
}

function isOverdue(iso: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(iso).getTime() < today.getTime();
}

interface PlanTaskRowProps {
  task: TaskTransport;
  onComplete: () => void;
  onMoveToTomorrow: () => void;
  onRemove: () => void;
  onStartTimer: () => void;
}

/**
 * Una fila del plan tiene dos niveles: el título, a dos líneas como mucho, y
 * una línea de meta. Vencida lleva la palabra delante de la fecha; crítica es
 * peso, no color. A la derecha, la energía que pide y cuánto dura.
 */
export function PlanTaskRow({ task, onComplete, onMoveToTomorrow, onRemove, onStartTimer }: PlanTaskRowProps) {
  const isDone = task.status === 'done';
  const dur = estimatedLabel(task.estimatedTime);
  const overdue = task.dueDate ? isOverdue(task.dueDate) : false;
  const meta: React.ReactNode[] = [];
  if (task.dueDate) {
    meta.push(
      overdue ? (
        <span key="due">
          <b className="font-semibold text-task-overdue">vencida</b> · {shortDate(task.dueDate)}
        </span>
      ) : (
        <span key="due">vence {shortDate(task.dueDate)}</span>
      ),
    );
  }
  if (task.taskType === 'event') meta.push(<span key="type">evento</span>);
  const side = [ENERGY_LABEL[task.energyLevel] ?? 'media', dur].filter(Boolean).join(' · ');

  return (
    <div className={cn('group grid grid-cols-[1.3rem_1fr_auto] items-start gap-3 py-3', isDone && 'opacity-50')}>
      <button
        type="button"
        onClick={onComplete}
        className={cn(
          'mt-0.5 flex size-[1.3rem] items-center justify-center rounded-full border-2 transition-colors',
          isDone ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:border-primary',
        )}
        aria-label={isDone ? 'Deshacer' : 'Completar'}
      >
        {isDone && <Check className="size-3" strokeWidth={3} />}
      </button>

      <div className="min-w-0">
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
          {meta.map((m, i) => (
            <span key={i}>
              {i > 0 && ' · '}
              {m}
            </span>
          ))}
          {/* En el teléfono la energía y la duración van aquí; en laptop, a la derecha. */}
          <span className="md:hidden">
            {meta.length > 0 && ' · '}
            {side}
          </span>
        </p>
      </div>

      <div className="flex items-center gap-1">
        <span className="hidden whitespace-nowrap pt-0.5 text-xs text-muted-foreground tabular-nums md:inline">{side}</span>
        {!isDone && (
          <div className="flex items-center md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <Button size="icon-xs" variant="ghost" onClick={onStartTimer} aria-label="Iniciar timer">
              <Play className="size-3.5" />
            </Button>
            <Button size="icon-xs" variant="ghost" onClick={onMoveToTomorrow} aria-label="Mover a mañana">
              <CalendarArrowUp className="size-3.5" />
            </Button>
            <Button size="icon-xs" variant="ghost" onClick={onRemove} aria-label="Quitar del plan">
              <X className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
