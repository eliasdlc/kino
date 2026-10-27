"use client";

import { ChevronDown, ListChecks, Timer, Trash2 } from "lucide-react";
import type { TaskMetadata } from "../tasks.types";
import { SubtaskList } from "../SubtaskList";
import { TaskRow, defaultTaskMeta, type TaskRowAction, type TaskRowDensity } from "../TaskRow";
import { estimatedMinutes } from "../task-vocab";
import { useTaskCard, type TaskCardState } from "./useTaskCard";
import type { TaskCardProps } from "./types";
import type { SystemType } from "@/shared/lib/system-types";

export type { TaskCardState };

interface DefaultTaskCardProps extends TaskCardProps {
  systemType?: SystemType;
  /**
   * La meta propia de un tipo de sistema, en piezas que la fila une con comas
   * (la clase y la entrega en académico, el hábito y su repetición en
   * personal). Sin ella, la meta común: fecha, prioridad, energía.
   */
  metaParts?: (state: TaskCardState) => React.ReactNode[];
  isSelected?: boolean;
  onSelectionToggle?: (taskId: string) => void;
  /** Personal, la fila que no grita prioridad: la prioridad no entra en la meta. */
  soft?: boolean;
  /** Densidad de la fila: `lista` por defecto, `compacta` en columnas estrechas. */
  density?: TaskRowDensity;
  /** Tachada en esta visita (la lista que la pinta decide cuándo se va). */
  struck?: boolean;
}

/**
 * La tarea en una vista de sistema. Ya no es una card: es la fila de tarea
 * común (`TaskRow`), con su círculo de 48 px en el margen, su meta en español
 * y sus acciones con nombre (foco, subtareas, papelera) en una hoja en el
 * teléfono y en un menú en escritorio. Conserva el nombre y las props con las
 * que la usan las vistas de sistema, para que todas cambien a la vez.
 *
 * Las subtareas se abren debajo de la fila, en la columna de texto, y sólo se
 * piden al abrirlas: la fila ya no lanza una suscripción por tarea para
 * pintar una barra de progreso (el N+1 de `useSubtasks`).
 */
export function DefaultTaskCard({
  task,
  systemId,
  systemType,
  isFocused,
  onToggle,
  onDelete,
  onEdit,
  metaParts,
  isSelected,
  onSelectionToggle,
  soft,
  density = "lista",
  struck,
}: DefaultTaskCardProps) {
  const state = useTaskCard(task, systemId, onToggle);
  const { isDone, isThisRunning, anotherRunning, isExpanded, setIsExpanded, handleToggle, openModeDialog } = state;

  const why = systemType === "personal" ? (task.metadata as TaskMetadata | null)?.why : undefined;
  // Un tipo sin nada propio que decir de esta tarea cae a la meta común.
  const propia = metaParts?.(state);
  const meta =
    propia && propia.length > 0 ? propia : defaultTaskMeta(soft ? { ...task, effectivePriority: "medium" } : task, why);

  const actions: TaskRowAction[] = [];
  if (!isDone) {
    actions.push({
      label: isThisRunning ? "Timer en curso" : "Iniciar foco",
      icon: Timer,
      disabled: anotherRunning,
      onSelect: () =>
        openModeDialog({
          id: task.id,
          title: task.title,
          systemId,
          estimatedDuration: estimatedMinutes(task.estimatedTime),
        }),
    });
  }
  actions.push({
    label: isExpanded ? "Ocultar subtareas" : "Ver subtareas",
    icon: ChevronDown,
    onSelect: () => setIsExpanded((v) => !v),
  });
  if (onSelectionToggle) {
    actions.push({
      label: isSelected ? "Quitar de la selección" : "Seleccionar",
      icon: ListChecks,
      onSelect: () => onSelectionToggle(task.id),
    });
  }
  actions.push({ label: "Mover a la papelera", icon: Trash2, destructive: true, onSelect: () => onDelete(task) });

  return (
    <div data-slot="task-card" className="border-b border-border last:border-b-0">
      <TaskRow
        task={task}
        density={density}
        struck={struck}
        focused={isFocused}
        onComplete={handleToggle}
        onOpen={onEdit ? () => onEdit(task) : undefined}
        meta={meta}
        trailing={density === "compacta" ? null : undefined}
        actions={actions}
        className="border-b-0"
        selection={
          onSelectionToggle
            ? { selected: Boolean(isSelected), visible: Boolean(isSelected), onToggle: () => onSelectionToggle(task.id) }
            : undefined
        }
      />
      {isExpanded && (
        <div className="pb-2 pl-(--margen)">
          <SubtaskList parentTaskId={task.id} systemId={systemId} />
        </div>
      )}
    </div>
  );
}
