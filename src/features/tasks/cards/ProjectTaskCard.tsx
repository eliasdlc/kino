"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, Clock, Flag, Hourglass, MoreHorizontal, Timer, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTags } from "@/features/tags/tags.hooks";
import { tagDotClass } from "@/features/tags/tag-colors";
import { useSprints } from "@/features/sprints/sprints.hooks";
import { PROJECT_BOARD_COLUMNS } from "@/shared/lib/system-types";
import { parseDueDate } from "../tasks.utils";
import { useTaskCard } from "./useTaskCard";
import { TaskTags } from "./parts/TaskTags";
import { SubtaskProgressBars } from "./parts/SubtaskProgressBars";
import { SubtaskList } from "../SubtaskList";
import type { TaskCardProps } from "./types";

function formatEstimate(value: string | null): string | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (!h && !m) return null;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

function estimateToMinutes(value: string | null): number | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Ticket del board kanban (systemType `project`). Layout vertical propio
 * (tags → título → meta → progreso de subtareas), distinto de la fila genérica
 * de `DefaultTaskCard`. Sin avatares (app mono-usuario). Comparte estado y
 * handlers con el resto vía `useTaskCard`.
 */
interface ProjectTaskCardProps extends TaskCardProps {
  /** Muestra a qué sprint pertenece (solo en la vista 'Todas', donde no es redundante). */
  showSprint?: boolean;
  /** Mueve la tarjeta a otra columna del board (solo en mobile). */
  onMoveColumn?: (boardStatus: string) => void;
}

export function ProjectTaskCard({ task, systemId, onToggle, onDelete, onEdit, showSprint, onMoveColumn }: ProjectTaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const state = useTaskCard(task, systemId, onToggle);
  const { isDone, isOverdue, dueDays, timerState, openModeDialog } = state;

  const isThisRunning = timerState.taskId === task.id && timerState.phase !== "idle";
  const anotherRunning = timerState.phase !== "idle" && !isThisRunning;

  const estimate = formatEstimate(task.estimatedTime);
  const dueUrgent = isOverdue || dueDays === 0;
  // En el board el "hecho" lo da la columna terminal (mover la tarjeta), no un
  // toggle: una tarea no puede estar en progreso y completada a la vez. Por eso
  // el menú solo ofrece foco/eliminar, nunca "completar".
  const showActions = !isDone;

  const { data: tags = [] } = useTags(systemId);
  const category = task.contextTagId ? tags.find((t) => t.id === task.contextTagId) : undefined;

  const { data: sprints = [] } = useSprints(systemId);
  const sprint = showSprint && task.sprintId ? sprints.find((s) => s.id === task.sprintId) : undefined;

  const startFocus = () =>
    openModeDialog({
      id: task.id,
      title: task.title,
      systemId,
      estimatedDuration: estimateToMinutes(task.estimatedTime),
    });

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "bg-card border border-border rounded-[18px] p-[18px] flex flex-col gap-3.5 shadow-sm",
            "motion-safe:transition-colors hover:border-foreground/20",
            isDone && "opacity-50",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-2">
              {(category || sprint) && (
                <div className="flex items-center gap-3 flex-wrap text-[11px] font-medium text-muted-foreground">
                  {category && (
                    <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", tagDotClass(category.color))} />
                      {category.title}
                    </span>
                  )}
                  {sprint && (
                    <span className="inline-flex items-center gap-1">
                      <Flag size={11} className="text-primary" />
                      {sprint.name}
                    </span>
                  )}
                </div>
              )}
              <TaskTags task={task} />
            </div>

            {/* Acciones en touch: en desktop se usa click derecho (context menu). */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label="Acciones"
                  className="md:hidden shrink-0 -mr-1 -mt-1 p-1 text-muted-foreground/85 hover:text-foreground/85"
                >
                  <MoreHorizontal size={18} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {showActions && (
                  <DropdownMenuItem disabled={anotherRunning} onSelect={startFocus}>
                    <Timer className={cn(isThisRunning && "text-amber-600 dark:text-amber-400")} />
                    {isThisRunning ? "Timer en curso" : "Iniciar foco"}
                  </DropdownMenuItem>
                )}
                {onMoveColumn && (() => {
                  const currentCol = task.boardStatus ?? PROJECT_BOARD_COLUMNS[0].id;
                  const others = PROJECT_BOARD_COLUMNS.filter((c) => c.id !== currentCol);
                  if (others.length === 0) return null;
                  return (
                    <>
                      <DropdownMenuSeparator />
                      {others.map((col) => (
                        <DropdownMenuItem key={col.id} onSelect={() => onMoveColumn(col.id)}>
                          {col.label}
                        </DropdownMenuItem>
                      ))}
                    </>
                  );
                })()}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onDelete(task)}>
                  <Trash2 />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <button
            type="button"
            onClick={() => onEdit?.(task)}
            className={cn(
              "text-card-foreground text-[15px] font-semibold leading-snug tracking-wide text-left",
              isDone && "line-through text-muted-foreground/85",
            )}
          >
            {task.title}
          </button>

          {(task.dueDate || estimate) && (
            <div className="flex items-center gap-4 text-[13px] font-medium mt-0.5">
              {task.dueDate && (
                <span className={cn("inline-flex items-center gap-1.5", dueUrgent ? "text-task-overdue" : "text-muted-foreground")}>
                  <Clock size={15} />
                  {isOverdue ? "Vencida" : dueDays === 0 ? "Hoy" : format(parseDueDate(task.dueDate), "MMM d")}
                </span>
              )}
              {estimate && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Hourglass size={14} />
                  {estimate}
                </span>
              )}
            </div>
          )}

          {/* KIN-81: progress + expand toggle to show subtasks inline */}
          <div className="flex items-center justify-between mt-1">
            <SubtaskProgressBars taskId={task.id} systemId={systemId} />
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setIsExpanded((v) => !v); }}
              aria-label={isExpanded ? "Ocultar subtareas" : "Mostrar subtareas"}
              className="text-muted-foreground/65 hover:text-foreground/85 transition-colors"
            >
              <ChevronDown size={14} className={cn("transition-transform", isExpanded && "rotate-180")} />
            </button>
          </div>

          {isExpanded && (
            <div className="mt-2 pt-2 border-t border-border">
              <SubtaskList parentTaskId={task.id} systemId={systemId} />
            </div>
          )}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-52">
        {showActions && (
          <>
            <ContextMenuItem disabled={anotherRunning} onSelect={startFocus}>
              <Timer className={cn(isThisRunning && "text-amber-600 dark:text-amber-400")} />
              {isThisRunning ? "Timer en curso" : "Iniciar foco"}
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem variant="destructive" onSelect={() => onDelete(task)}>
          <Trash2 />
          Eliminar
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
