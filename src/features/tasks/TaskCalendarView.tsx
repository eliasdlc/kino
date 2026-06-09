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
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { addWeeks, startOfWeek, endOfWeek, format, isWithinInterval, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { useTasks, useUpdateTask } from "./tasks.hooks";
import { DroppableColumn } from "./dnd/DroppableColumn";
import { parseDueDate } from "./tasks.utils";
import { SYSTEM_TYPE_CONFIG } from "@/shared/lib/system-types";
import { cn } from "@/lib/utils";
import type { Task } from "./tasks.types";

interface TaskCalendarViewProps {
  systemId: string;
  initialData: Task[];
  onEdit?: (task: Task) => void;
}

const WEEKS_AHEAD = 24;

function isoWeekId(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function DraggableChip({ task, onEdit }: { task: Task; onEdit?: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const course = (task.metadata as { course?: string } | null)?.course;
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "px-3 py-2 rounded-lg bg-muted border border-border cursor-grab active:cursor-grabbing text-sm",
        isDragging && "opacity-30"
      )}
      onClick={() => onEdit?.(task)}
    >
      <span className="font-medium truncate block">{task.title}</span>
      {course && <span className="text-xs text-muted-foreground">{course}</span>}
    </div>
  );
}

/**
 * CalendarTab — timeline semanal de entregas (zoom-out). Arrastra una tarea
 * sin fecha a una semana para asignarle dueDate. No es la vista por defecto
 * de Academic; el foco diario vive en EstaSemana.
 */
export function TaskCalendarView({ systemId, initialData, onEdit }: TaskCalendarViewProps) {
  const { data: allTasks = [] } = useTasks(systemId, initialData);
  const { mutate: updateDueDate } = useUpdateTask(systemId);

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
    const weekTasks = withDate.filter((t) =>
      isWithinInterval(parseDueDate(t.dueDate!), { start: monday, end: sunday })
    );
    return { id, monday, sunday, tasks: weekTasks };
  });

  const statuses = SYSTEM_TYPE_CONFIG.academic.statuses;

  function handleDragStart({ active }: DragStartEvent) {
    setDraggingTask(activeTasks.find((t) => t.id === active.id) ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggingTask(null);
    if (!over) return;
    updateDueDate({ taskId: active.id as string, data: { dueDate: over.id as string } });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {withDate.length} con fecha · {withoutDate.length} sin fecha
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4">
          {/* Panel sin fecha */}
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
                  <DraggableChip key={task.id} task={task} onEdit={onEdit} />
                ))
              )}
            </div>
          </div>

          {/* Timeline horizontal */}
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-3 min-w-max pb-2">
              {weeks.map((week) => (
                <DroppableColumn
                  key={week.id}
                  id={week.id}
                  className="w-48 shrink-0 rounded-xl border bg-muted/30 p-3 flex flex-col gap-2"
                >
                  <div className="text-xs">
                    <span className="font-semibold text-foreground">
                      {format(week.monday, "MMM d", { locale: es })}
                    </span>
                    <span className="text-muted-foreground"> — {format(week.sunday, "d")}</span>
                  </div>

                  <div className="space-y-1.5 min-h-[40px]">
                    {week.tasks.map((task) => {
                      const statusDef = statuses.find((s) => s.name === task.status);
                      const course = (task.metadata as { course?: string } | null)?.course;
                      return (
                        <div
                          key={task.id}
                          className="px-2.5 py-2 rounded-lg bg-background border border-border cursor-pointer text-sm hover:border-primary/50 transition-colors"
                          onClick={() => onEdit?.(task)}
                        >
                          <span className="font-medium block truncate">{task.title}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {statusDef && (
                              <span className="text-xs text-muted-foreground">
                                {statusDef.emoji ?? ""} {statusDef.label}
                              </span>
                            )}
                            {course && (
                              <span className="text-xs text-muted-foreground/60 truncate">· {course}</span>
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
    </div>
  );
}
