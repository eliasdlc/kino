"use client";

import { useState } from "react";
import { ArrowRightLeft, ChevronDown, Timer, Trash2 } from "lucide-react";
import { useTags } from "@/features/tags/tags.hooks";
import { useSprints } from "@/features/sprints/sprints.hooks";
import { SubtaskList } from "../SubtaskList";
import { TaskRow, defaultTaskMeta, type TaskRowAction } from "../TaskRow";
import { estimatedMinutes } from "../task-vocab";
import { useTaskCard } from "./useTaskCard";
import type { TaskCardProps } from "./types";

interface ProjectTaskCardProps extends TaskCardProps {
  /** Muestra a qué ciclo pertenece (sólo en la vista Todas, donde no es redundante). */
  showSprint?: boolean;
  /** Abre la hoja de mover, el equivalente con nombre del arrastre. */
  onRequestMove?: () => void;
}

/**
 * El ticket del tablero de proyecto. Ya no es una card con chips: es la fila
 * de tarea común (`TaskRow`), con la categoría y el ciclo delante en la meta,
 * la fecha en español y la estimación en la cola. Sus acciones con nombre
 * (foco, mover a otra columna, subtareas, papelera) salen en una hoja con el
 * dedo y en un menú con el ratón.
 *
 * En el tablero "hecho" lo da la columna terminal (mover el ticket), no un
 * toque: una tarea no puede estar en progreso y completada a la vez. Por eso
 * el círculo es un aro que se llena cuando el ticket llega a Hecho, pero no es
 * botón. Las subtareas se abren debajo, en la columna de texto, y sólo se
 * piden al abrirlas.
 */
export function ProjectTaskCard({ task, systemId, isFocused, onToggle, onDelete, onEdit, showSprint, onRequestMove }: ProjectTaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isDone, isThisRunning, anotherRunning, openModeDialog } = useTaskCard(task, systemId, onToggle);

  const { data: tags = [] } = useTags(systemId);
  const category = task.contextTagId ? tags.find((t) => t.id === task.contextTagId) : undefined;
  const { data: sprints = [] } = useSprints(systemId);
  const sprint = showSprint && task.sprintId ? sprints.find((s) => s.id === task.sprintId) : undefined;

  const contexto = [category?.title, sprint?.name].filter(Boolean).join(", ");

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
  if (onRequestMove) actions.push({ label: "Mover a otra columna", icon: ArrowRightLeft, onSelect: onRequestMove });
  actions.push({
    label: isExpanded ? "Ocultar subtareas" : "Ver subtareas",
    icon: ChevronDown,
    onSelect: () => setIsExpanded((v) => !v),
  });
  actions.push({ label: "Mover a la papelera", icon: Trash2, destructive: true, onSelect: () => onDelete(task) });

  return (
    <div data-slot="task-card" className="border-b border-border last:border-b-0">
      <TaskRow
        task={task}
        density="lista"
        completable={false}
        onComplete={() => {}}
        focused={isFocused}
        onOpen={onEdit ? () => onEdit(task) : undefined}
        meta={defaultTaskMeta(task, contexto || undefined)}
        actions={actions}
        className="border-b-0"
      />
      {isExpanded && (
        <div className="pb-2 pl-(--margen)">
          <SubtaskList parentTaskId={task.id} systemId={systemId} />
        </div>
      )}
    </div>
  );
}
