'use client';

import { useState } from 'react';
import { Check, MoreHorizontal, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarginRow } from '@/components/ui/margin-row';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { cn } from '@/lib/utils';
import type { TaskTransport } from './tasks.types';
import { dueMeta, energyMeta, estimatedLabel, priorityMeta } from './task-vocab';
import { usePunteroGrueso } from './use-puntero-grueso';

/**
 * Las tres densidades de la misma fila:
 * - `plan`: Hoy y lo sugerido. Título a dos líneas en 600, la duración en la cola.
 * - `lista`: /tasks y las vistas de sistema. Igual, con el sistema o la carpeta
 *   en la meta y el título en 500, porque una lista larga pesa menos que un plan.
 * - `compacta`: columnas estrechas (la semana de Planificación, el tablero). El
 *   margen se estrecha en escritorio, el título va en `text-sm` y no hay cola.
 */
export type TaskRowDensity = 'plan' | 'lista' | 'compacta';

/** Una acción de fila. En el teléfono va en una hoja con su nombre; en escritorio, en un menú. */
export interface TaskRowAction {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export interface TaskRowProps {
  task: TaskTransport;
  density?: TaskRowDensity;
  /** Tachada en esta visita: el círculo se rellena con la animación y la fila no se mueve. */
  struck?: boolean;
  onComplete: () => void;
  /**
   * Falso cuando la fila no se completa con el círculo: el ticket del tablero
   * de proyecto se termina moviéndolo a Hecho. El margen conserva el aro (lleno
   * si ya está hecha) para que la fila siga siendo la misma, pero no es botón.
   */
  completable?: boolean;
  /** Abre el detalle: el título y la meta son un solo botón. */
  onOpen?: () => void;
  /** Lo que va antes de la fecha en la meta: el sistema, la carpeta, el porqué. */
  context?: React.ReactNode;
  /** Reemplaza la meta calculada (las cards por tipo de sistema dicen otras cosas). */
  meta?: React.ReactNode[];
  /** Reemplaza la cola (por defecto, la duración estimada). */
  trailing?: React.ReactNode;
  actions?: TaskRowAction[];
  /** Selección múltiple. `visible` cuando ya hay alguna elegida: entonces todas enseñan su casilla. */
  selection?: { selected: boolean; visible: boolean; onToggle: () => void };
  /** Foco del teclado (j y k): un anillo dentro de la fila. */
  focused?: boolean;
  className?: string;
}

/** La meta por defecto: vencida o vence con su fecha, la prioridad si pesa, la energía y el evento. */
export function defaultTaskMeta(task: TaskTransport, context?: React.ReactNode): React.ReactNode[] {
  const isDone = task.status === 'done';
  const meta: React.ReactNode[] = [];
  if (context) meta.push(<span key="context">{context}</span>);
  const due = dueMeta(task.dueDate, isDone);
  if (due.word) {
    meta.push(
      due.overdue ? (
        <span key="due">
          <b className="font-semibold text-task-overdue">vencida</b> {due.when}
        </span>
      ) : (
        <span key="due">vence {due.when}</span>
      ),
    );
  }
  const priority = priorityMeta(task.effectivePriority);
  if (priority) meta.push(<b key="priority" className="font-semibold text-body">{priority}</b>);
  meta.push(<span key="energy">{energyMeta(task.energyLevel)}</span>);
  if (task.taskType === 'event') meta.push(<span key="type">evento</span>);
  return meta;
}

/**
 * La fila de tarea de Diario, una sola para todo el producto: Hoy, Tareas, las
 * vistas de sistema y el catálogo la pintan igual, con el mismo círculo, la
 * misma fecha en español y la misma energía. El círculo de completar mide 48
 * px y vive en el margen; vencida es la palabra delante de la fecha y lo único
 * en coral; la prioridad es peso del título y una palabra en negrita, nunca un
 * tinte. Hecha se dice con --ok en el círculo y el título tachado en mute.
 *
 * Un toque en el círculo la tacha y la fila no se mueve: quien la usa decide
 * cuándo se va (Hoy y Tareas la dejan en su sitio hasta la siguiente visita).
 * El nombre del círculo es fijo, "Completar" y el título, y su estado lo dice
 * `aria-pressed`. Mientras está tachada pierde las acciones pero conserva su
 * hueco, para que la cola no salte en horizontal.
 */
export function TaskRow({
  task,
  density = 'lista',
  struck = false,
  onComplete,
  completable = true,
  onOpen,
  context,
  meta,
  trailing,
  actions,
  selection,
  focused,
  className,
}: TaskRowProps) {
  const isDone = task.status === 'done';
  const compacta = density === 'compacta';
  const pieces = meta ?? defaultTaskMeta(task, context);
  const dur = estimatedLabel(task.estimatedTime);
  const cola = trailing !== undefined ? trailing : compacta ? null : dur ? <span className={cn(isDone && 'line-through')}>{dur}</span> : null;
  const conAcciones = Boolean(actions && actions.length > 0);

  const titulo = (
    <>
      <span
        data-slot="task-row-title"
        className={cn(
          'block leading-tight tracking-[-0.005em] text-foreground transition-colors duration-(--dur-tachar) ease-(--ease-pluma)',
          compacta ? 'line-clamp-3 text-sm font-medium' : 'line-clamp-2 text-base',
          density === 'plan' && 'font-semibold',
          density === 'lista' && (task.effectivePriority === 'high' ? 'font-semibold' : 'font-medium'),
          task.effectivePriority === 'critical' && 'font-bold',
          isDone && 'text-muted-foreground line-through decoration-input',
        )}
      >
        {task.title}
      </span>
      {pieces.length > 0 && (
        <span className={cn('mt-0.5 block leading-snug text-muted-foreground', compacta ? 'text-xs' : 'text-[0.82rem]')}>
          {pieces.map((m, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {m}
            </span>
          ))}
        </span>
      )}
    </>
  );

  const circulo = (
    <span
      className={cn(
        'flex items-center justify-center rounded-full border-[1.6px] transition-[background-color,border-color,transform] duration-(--dur-tachar) ease-(--ease-pluma)',
        compacta ? 'size-[1.2rem]' : 'size-[1.35rem]',
        isDone ? 'border-task-done bg-task-done text-task-done-foreground' : 'border-input group-hover:border-foreground/60',
        isDone && struck && 'anim-tachar',
      )}
      aria-hidden
    >
      {isDone && <Check className="size-3" strokeWidth={3} />}
    </span>
  );

  return (
    <MarginRow
      data-struck={struck ? '' : undefined}
      data-density={density}
      className={cn(
        'group',
        compacta && 'md:[--margen:2.2rem] md:min-h-[2.85rem]',
        isDone && 'text-muted-foreground',
        selection?.selected && 'bg-sf2/70',
        focused && 'ring-1 ring-primary/40 ring-inset',
        className,
      )}
      margin={
        completable ? (
          <button
            type="button"
            onClick={onComplete}
            className={cn(
              'press focus-ring -mt-[0.15rem] flex size-[2.85rem] items-center justify-center rounded-full transition-transform duration-(--dur-toque) ease-(--ease-pluma)',
              compacta && 'md:pointer-fine:size-8',
            )}
            aria-label={`Completar ${task.title}`}
            aria-pressed={isDone}
          >
            {circulo}
          </button>
        ) : (
          <span className={cn('-mt-[0.15rem] flex size-[2.85rem] items-center justify-center', compacta && 'md:pointer-fine:size-8')}>{circulo}</span>
        )
      }
      trailing={
        cola || conAcciones || selection ? (
          <span className="inline-flex items-center gap-1">
            {cola}
            {selection && (selection.visible || selection.selected) && (
              <SelectionBox selected={selection.selected} onToggle={selection.onToggle} title={task.title} />
            )}
            {selection && !selection.visible && !selection.selected && (
              <span className="hidden md:pointer-fine:inline-flex">
                <SelectionBox selected={false} onToggle={selection.onToggle} title={task.title} hoverOnly />
              </span>
            )}
            {conAcciones &&
              (struck && isDone ? (
                // Tachada, la fila pierde el menú pero conserva su hueco: la
                // duración y el título no se mueven en horizontal.
                <span data-slot="menu-hueco" className="-mr-2 block size-[2.85rem] md:size-8 md:pointer-coarse:size-[2.85rem]" aria-hidden />
              ) : (
                <TaskRowActions title={task.title} actions={actions!} />
              ))}
          </span>
        ) : undefined
      }
    >
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="focus-ring -my-1 block w-full rounded-sm py-1 text-left"
          aria-label={`Abrir ${task.title}`}
        >
          {titulo}
        </button>
      ) : (
        titulo
      )}
    </MarginRow>
  );
}

function SelectionBox({ selected, onToggle, title, hoverOnly }: { selected: boolean; onToggle: () => void; title: string; hoverOnly?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      role="checkbox"
      aria-checked={selected}
      aria-label={`Seleccionar ${title}`}
      className={cn(
        'focus-ring flex size-[2.85rem] items-center justify-center rounded-full md:pointer-fine:size-8',
        hoverOnly && 'md:opacity-0 md:transition-opacity md:duration-(--dur-toque) md:group-hover:opacity-100 md:group-focus-within:opacity-100',
      )}
    >
      <span
        className={cn(
          'flex size-[1.15rem] items-center justify-center rounded-[0.3rem] border-[1.6px] transition-[background-color,border-color] duration-(--dur-toque) ease-(--ease-pluma)',
          selected ? 'border-foreground bg-foreground text-background' : 'border-input',
        )}
        aria-hidden
      >
        {selected && <Check className="size-3" strokeWidth={3} />}
      </span>
    </button>
  );
}

/**
 * Las acciones de una fila. Con el dedo, un botón de 48 px abre una hoja con
 * las acciones nombradas en renglones de 48 px: un menú flotante pide
 * puntería y el pulgar no la tiene. Con ratón, un menú que aparece al pasar o
 * con el foco. Lo decide el puntero, no el ancho: una tableta se toca.
 *
 * El botón mide lo mismo en los dos caminos y en la hidratación, cuando aún
 * no se sabe el puntero, para que la cola de la fila no cambie de ancho y el
 * título no se reparta en otras líneas al terminar de cargar.
 */
export function TaskRowActions({ title, actions }: { title: string; actions: TaskRowAction[] }) {
  const tactil = usePunteroGrueso();
  const [open, setOpen] = useState(false);
  const comunes = actions.filter((a) => !a.destructive);
  const destructivas = actions.filter((a) => a.destructive);
  const disparador = cn(
    '-mr-2 size-[2.85rem] text-muted-foreground md:pointer-fine:size-8',
    'md:pointer-fine:opacity-0 md:pointer-fine:transition-opacity md:pointer-fine:duration-(--dur-toque) md:pointer-fine:group-hover:opacity-100 md:pointer-fine:group-focus-within:opacity-100 md:pointer-fine:aria-expanded:opacity-100',
  );
  // El nombre es el mismo en todas las filas: Hoy lo busca así (PlanTaskRow.test).
  const nombre = 'Más acciones';

  if (tactil !== false) {
    return (
      <>
        <Button size="icon" variant="ghost" aria-label={nombre} className={disparador} onClick={() => tactil && setOpen(true)}>
          <MoreHorizontal />
        </Button>
        {tactil && (
          <ResponsiveDialog open={open} onOpenChange={setOpen}>
            <ResponsiveDialogContent className="sm:max-w-sm">
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle className="line-clamp-2">{title}</ResponsiveDialogTitle>
                <ResponsiveDialogDescription className="sr-only">Acciones de la tarea</ResponsiveDialogDescription>
              </ResponsiveDialogHeader>
              <div data-slot="task-row-actions-sheet">
                {actions.map((a) => {
                  const Icon = a.icon;
                  return (
                    <MarginRow
                      key={a.label}
                      margin={<Icon className="mt-[0.8rem] size-[1.15rem]" />}
                      onClick={() => {
                        if (a.disabled) return;
                        setOpen(false);
                        a.onSelect();
                      }}
                      aria-disabled={a.disabled || undefined}
                      className={cn('min-h-[3.2rem] text-base font-semibold', a.destructive ? 'text-destructive' : 'text-foreground', a.disabled && 'opacity-50')}
                    >
                      {a.label}
                    </MarginRow>
                  );
                })}
              </div>
            </ResponsiveDialogContent>
          </ResponsiveDialog>
        )}
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label={nombre} className={disparador}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {comunes.map((a) => {
          const Icon = a.icon;
          return (
            <DropdownMenuItem key={a.label} disabled={a.disabled} onSelect={a.onSelect}>
              <Icon />
              {a.label}
            </DropdownMenuItem>
          );
        })}
        {destructivas.length > 0 && comunes.length > 0 && <DropdownMenuSeparator />}
        {destructivas.map((a) => {
          const Icon = a.icon;
          return (
            <DropdownMenuItem key={a.label} variant="destructive" disabled={a.disabled} onSelect={a.onSelect}>
              <Icon />
              {a.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
