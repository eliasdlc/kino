'use client';

import { CalendarArrowUp, Check, MoreHorizontal, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarginRow } from '@/components/ui/margin-row';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { TaskTransport } from '@/features/tasks/tasks.types';

const ENERGY_LABEL: Record<string, string> = { high: 'alta', medium: 'media', low: 'baja' };
const PRIORITY_LABEL: Record<string, string> = { critical: 'crítica', high: 'alta' };

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
  /** Tachada en esta visita: el círculo se rellena con la animación de tachar. */
  struck?: boolean;
  onComplete: () => void;
  onMoveToTomorrow: () => void;
  onRemove: () => void;
  onStartTimer: () => void;
}

/**
 * La fila del plan es una fila de margen: el círculo de completar, de 48 px,
 * vive en el margen; el título a dos líneas y una línea de meta ocupan la
 * columna de texto; la duración va a la derecha, en mute y tabular. Vencida
 * lleva la palabra delante de la fecha y es lo único en coral; la prioridad y
 * la energía son palabras en peso, no color. Un toque la tacha: el círculo se
 * rellena con --ok y el título cae a mute; la fila no se mueve de su sitio.
 * Las otras acciones (timer, mañana, quitar) caben en un solo menú de 48 px,
 * que en escritorio aparece al pasar el ratón.
 *
 * El círculo tiene un solo nombre, "Completar" y el título, y su estado lo
 * dice `aria-pressed`: un nombre que cambia a "Deshacer" a la vez que el
 * estado pasa a pulsado se lee como dos señales que se contradicen.
 */
export function PlanTaskRow({ task, struck = false, onComplete, onMoveToTomorrow, onRemove, onStartTimer }: PlanTaskRowProps) {
  const isDone = task.status === 'done';
  const dur = estimatedLabel(task.estimatedTime);
  const overdue = task.dueDate ? isOverdue(task.dueDate) : false;
  const priority = PRIORITY_LABEL[task.effectivePriority];
  const meta: React.ReactNode[] = [];
  if (task.dueDate) {
    meta.push(
      overdue ? (
        <span key="due" className="font-semibold text-task-overdue">
          <b className="font-semibold text-task-overdue">vencida</b> {shortDate(task.dueDate)}
        </span>
      ) : (
        <span key="due">vence {shortDate(task.dueDate)}</span>
      ),
    );
  }
  if (priority) meta.push(<b key="priority" className="font-semibold text-body">{priority}</b>);
  meta.push(<span key="energy">energía {ENERGY_LABEL[task.energyLevel] ?? 'media'}</span>);
  if (task.taskType === 'event') meta.push(<span key="type">evento</span>);

  return (
    <MarginRow
      data-struck={struck ? '' : undefined}
      className={cn('group', isDone && 'text-muted-foreground')}
      margin={
        <button
          type="button"
          onClick={onComplete}
          className="press focus-ring -mt-[0.15rem] flex size-[2.85rem] items-center justify-center rounded-full transition-transform duration-(--dur-toque) ease-(--ease-pluma)"
          aria-label={`Completar ${task.title}`}
          aria-pressed={isDone}
        >
          <span
            className={cn(
              'flex size-[1.35rem] items-center justify-center rounded-full border-[1.6px] transition-[background-color,border-color,transform] duration-(--dur-tachar) ease-(--ease-pluma)',
              isDone ? 'border-task-done bg-task-done text-task-done-foreground' : 'border-input group-hover:border-foreground/60',
              isDone && struck && 'anim-tachar',
            )}
            aria-hidden
          >
            {isDone && <Check className="size-3" strokeWidth={3} />}
          </span>
        </button>
      }
      trailing={
        <span className="inline-flex items-center gap-1">
          {dur && <span className={cn(isDone && 'line-through')}>{dur}</span>}
          {/* Hecha, la fila pierde el menú pero conserva su hueco: la duración
              y el título no se mueven en horizontal al tachar. */}
          {isDone ? (
            <span data-slot="menu-hueco" className="-mr-2 block size-[2.85rem] md:size-8" aria-hidden />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Más acciones"
                  className="-mr-2 text-muted-foreground md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:aria-expanded:opacity-100"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onStartTimer}>
                  <Play />
                  Iniciar timer
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onMoveToTomorrow}>
                  <CalendarArrowUp />
                  Mover a mañana
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onRemove}>
                  <X />
                  Quitar del plan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </span>
      }
    >
      <span
        className={cn(
          'line-clamp-2 block text-base leading-tight font-semibold tracking-[-0.005em] text-foreground transition-colors duration-(--dur-tachar) ease-(--ease-pluma)',
          task.effectivePriority === 'critical' && 'font-bold',
          isDone && 'text-muted-foreground line-through decoration-input',
        )}
      >
        {task.title}
      </span>
      <span className="mt-0.5 block text-[0.82rem] leading-snug text-muted-foreground">
        {meta.map((m, i) => (
          <span key={i}>
            {i > 0 && ', '}
            {m}
          </span>
        ))}
      </span>
    </MarginRow>
  );
}
