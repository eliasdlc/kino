"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { addWeeks, startOfWeek, endOfWeek, format, parseISO, isWithinInterval, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { useTasks, useUpdateTask, useToggleTask, useDeleteTask } from "@/features/tasks/tasks.hooks";
import { TaskCard } from "@/features/tasks/TaskCard";
import { TaskDetailSheet } from "@/features/tasks/TaskDetailSheet";
import { CreateTaskDialog } from "@/features/tasks/CreateTaskDialog";
import { DroppableColumn } from "@/features/tasks/dnd/DroppableColumn";
import { cn } from "@/lib/utils";
import { SYSTEM_TYPE_CONFIG } from "@/shared/lib/system-types";
import type { Task } from "@/features/tasks/tasks.types";
import type { SystemViewProps } from "./SystemDetailView";

const WEEKS_AHEAD = 24;

function isoWeekId(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function DraggableChip({ task, onEdit }: { task: Task; systemId?: string; onEdit: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "px-3 py-2 rounded-lg bg-muted border border-border cursor-grab active:cursor-grabbing text-sm",
        isDragging && "opacity-30"
      )}
      onClick={() => onEdit(task)}
    >
      <span className="font-medium truncate block">{task.title}</span>
      {(task.metadata as { course?: string } | null)?.course && (
        <span className="text-xs text-muted-foreground">
          {(task.metadata as { course?: string }).course}
        </span>
      )}
    </div>
  );
}

export function SystemAcademicView({ system, initialTasks }: SystemViewProps) {
  const { data: allTasks = [] } = useTasks(system.id, initialTasks);
  const { mutate: updateDueDate } = useUpdateTask(system.id);
  const { mutate: toggleTask } = useToggleTask(system.id);
  const { mutate: deleteTask } = useDeleteTask(system.id);

  const [editTask, setEditTask] = useState<Task | null>(null);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const activeTasks = allTasks.filter((t) => !t.deletedAt && t.status !== "done");
  const withDate = activeTasks.filter((t) => !!t.dueDate);
  const withoutDate = activeTasks.filter((t) => !t.dueDate);

  const today = startOfToday();
  const weeks = Array.from({ length: WEEKS_AHEAD }, (_, i) => {
    const monday = startOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
    const sunday = endOfWeek(monday, { weekStartsOn: 1 });
    const id = isoWeekId(monday);
    const weekTasks = withDate.filter((t) => {
      const d = parseISO(t.dueDate!);
      return isWithinInterval(d, { start: monday, end: sunday });
    });
    return { id, monday, sunday, tasks: weekTasks };
  });

  const statuses = SYSTEM_TYPE_CONFIG.academic.statuses;

  function handleDragStart({ active }: DragStartEvent) {
    const task = activeTasks.find((t) => t.id === active.id);
    setDraggingTask(task ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggingTask(null);
    if (!over) return;
    const taskId = active.id as string;
    const weekStart = over.id as string; // ISO date of monday
    updateDueDate({ taskId, data: { dueDate: weekStart } });
  }

  function handleToggle(taskId: string) {
    toggleTask(taskId);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Timeline de entregas · {withDate.length} con fecha, {withoutDate.length} sin fecha
        </p>
        <CreateTaskDialog systemId={system.id} />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4">
          {/* Left panel — tasks without due date */}
          <div className="w-48 shrink-0">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
              Sin fecha
            </h3>
            <div className="space-y-1.5">
              {withoutDate.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 text-center py-4">
                  Todas las tareas tienen fecha ✓
                </p>
              ) : (
                withoutDate.map((task) => (
                  <DraggableChip
                    key={task.id}
                    task={task}
                    systemId={system.id}
                    onEdit={setEditTask}
                  />
                ))
              )}
            </div>
          </div>

          {/* Timeline — horizontal scroll */}
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-3 min-w-max pb-2">
              {weeks.map((week) => (
                <DroppableColumn
                  key={week.id}
                  id={week.id}
                  className="w-48 shrink-0 rounded-xl border bg-muted/30 p-3 flex flex-col gap-2"
                >
                  {/* Week header */}
                  <div className="text-xs">
                    <span className="font-semibold text-foreground">
                      {format(week.monday, "MMM d", { locale: es })}
                    </span>
                    <span className="text-muted-foreground"> — {format(week.sunday, "d")}</span>
                  </div>

                  {/* Tasks in this week */}
                  <div className="space-y-1.5 min-h-[40px]">
                    {week.tasks.map((task) => {
                      const statusDef = statuses.find((s) => s.name === task.status);
                      return (
                        <div
                          key={task.id}
                          className="px-2.5 py-2 rounded-lg bg-background border border-border cursor-pointer text-sm hover:border-primary/50 transition-colors"
                          onClick={() => setEditTask(task)}
                        >
                          <span className="font-medium block truncate">{task.title}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {statusDef && (
                              <span className="text-xs text-muted-foreground">
                                {statusDef.emoji ?? ""} {statusDef.label}
                              </span>
                            )}
                            {(task.metadata as { course?: string } | null)?.course && (
                              <span className="text-xs text-muted-foreground/60 truncate">
                                · {(task.metadata as { course?: string }).course}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {week.tasks.length === 0 && (
                      <p className="text-xs text-muted-foreground/30 text-center py-2">—</p>
                    )}
                  </div>
                </DroppableColumn>
              ))}
            </div>
          </div>
        </div>

        <DragOverlay>
          {draggingTask && (
            <div className="opacity-90 rotate-1 shadow-xl w-48 px-3 py-2 rounded-lg bg-muted border border-border text-sm font-medium">
              {draggingTask.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Done tasks */}
      {allTasks.filter((t) => t.status === "done").length > 0 && (
        <details className="pt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer select-none">
            Completadas ({allTasks.filter((t) => t.status === "done").length})
          </summary>
          <div className="mt-2 space-y-2">
            {allTasks.filter((t) => t.status === "done").map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                systemId={system.id}
                systemType="academic"
                onToggle={handleToggle}
                onDelete={(t) => deleteTask(t.id)}
                onEdit={setEditTask}
              />
            ))}
          </div>
        </details>
      )}

      <TaskDetailSheet
        task={editTask}
        systemId={system.id}
        open={editTask !== null}
        onOpenChange={(open) => { if (!open) setEditTask(null); }}
      />
    </div>
  );
}
