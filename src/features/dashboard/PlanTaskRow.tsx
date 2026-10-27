'use client';

import { CalendarArrowUp, Play, X } from 'lucide-react';
import { TaskRow } from '@/features/tasks/TaskRow';
import type { TaskTransport } from '@/features/tasks/tasks.types';

interface PlanTaskRowProps {
  task: TaskTransport;
  /** Tachada en esta visita: el círculo se rellena con la animación de tachar. */
  struck?: boolean;
  onComplete: () => void;
  onMoveToTomorrow: () => void;
  onRemove: () => void;
  onStartTimer: () => void;
  /** Abre el detalle de la tarea en su hoja. */
  onOpen?: () => void;
}

/**
 * La fila del plan es la fila de tarea común (`TaskRow`) en su densidad
 * `plan`: el círculo de 48 px en el margen, el título a dos líneas, la meta
 * con vencida en coral y la prioridad en peso, la duración a la derecha. Lo
 * propio de Hoy son sus tres acciones: timer, mañana y quitar del plan, que en
 * el teléfono salen en una hoja y en escritorio en un menú.
 */
export function PlanTaskRow({ task, struck = false, onComplete, onMoveToTomorrow, onRemove, onStartTimer, onOpen }: PlanTaskRowProps) {
  return (
    <TaskRow
      task={task}
      density="plan"
      struck={struck}
      onComplete={onComplete}
      onOpen={onOpen}
      actions={[
        { label: 'Iniciar timer', icon: Play, onSelect: onStartTimer },
        { label: 'Mover a mañana', icon: CalendarArrowUp, onSelect: onMoveToTomorrow },
        { label: 'Quitar del plan', icon: X, onSelect: onRemove },
      ]}
    />
  );
}
