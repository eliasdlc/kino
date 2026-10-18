"use client";

import { useCallback, useState } from "react";
import { differenceInCalendarDays, format, isAfter, isBefore, isSameDay, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DndContext,
  MouseSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DraggableTaskCard } from "./dnd/DraggableTaskCard";
import { DroppableColumn } from "./dnd/DroppableColumn";
import { TaskDragOverlay } from "./dnd/TaskDragOverlay";
import type { TaskDragData } from "./dnd/dnd.types";
import type { TaskTransport } from "./tasks.types";
import { parseDueDate, parseTaskDay } from "./tasks.utils";
import { MultiDayTaskBar } from "./MultiDayTaskBar";

export interface TaskPlanningBoardProps {
  systemId: string;
  weekDates: Date[];
  weekOffset: number;
  monthHeading: string;
  weekNumber: number;
  singleDayTasks: TaskTransport[];
  multiDayTasks: TaskTransport[];
  focusedTaskId: string | null;
  keyboardDisabled?: boolean;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onResetWeek: () => void;
  onToggle: (taskId: string) => void;
  onDelete: (task: TaskTransport) => void;
  onEdit?: (task: TaskTransport) => void;
  onMoveToDay: (taskId: string, dayISO: string) => void;
}

/**
 * La semana de Planificación en escritorio: siete columnas que reciben
 * tareas arrastradas. Vive en su propio módulo porque es lo único que necesita
 * `@dnd-kit`: `TaskPlanningView` la carga aparte y sólo en escritorio, así el
 * teléfono (que mueve de día con una hoja) no descarga el arrastre.
 */
export default function TaskPlanningBoard({
  systemId,
  weekDates,
  weekOffset,
  monthHeading,
  weekNumber,
  singleDayTasks,
  multiDayTasks,
  focusedTaskId,
  keyboardDisabled,
  onPrevWeek,
  onNextWeek,
  onResetWeek,
  onToggle,
  onDelete,
  onEdit,
  onMoveToDay,
}: TaskPlanningBoardProps) {
  const [activeTask, setActiveTask] = useState<TaskTransport | null>(null);

  const sensors = useSensors(
    // Sólo ratón y teclado: con el dedo no se arrastra (en una tableta el
    // toque desplaza la página). 8 px antes de arrastrar: un clic no se vuelve arrastre.
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, keyboardDisabled ? { keyboardCodes: { start: [], cancel: [], end: [] } } : {}),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as TaskDragData | undefined;
    if (data?.task) setActiveTask(data.task);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over) return;
      const data = active.data.current as TaskDragData | undefined;
      if (!data) return;
      const targetId = over.id as string;
      if (targetId === data.sourceId) return;
      onMoveToDay(data.task.id, targetId);
    },
    [onMoveToDay],
  );

  return (
    <DndContext
      id="task-planning-dnd"
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={onPrevWeek} aria-label="Semana anterior">
              <ChevronLeft className="size-5" />
            </Button>
            <h2 className="font-display text-[1.25rem] leading-tight font-bold tracking-[-0.02em] first-letter:uppercase">
              {monthHeading}
              <span className="ml-2 font-sans text-base font-normal text-muted-foreground tabular-nums">semana {weekNumber}</span>
            </h2>
            <Button variant="ghost" size="icon-sm" onClick={onNextWeek} aria-label="Semana siguiente">
              <ChevronRight className="size-5" />
            </Button>
          </div>
          {weekOffset !== 0 && (
            <Button variant="secondary" size="sm" onClick={onResetWeek}>
              Esta semana
            </Button>
          )}
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="min-w-[1120px] space-y-4">
            {multiDayTasks.length > 0 && (
              <div className="grid w-full grid-cols-7 gap-2 border-b border-border pt-1 pb-3">
                {multiDayTasks.map((task) => {
                  const start = parseDueDate(task.startDate!);
                  const due = parseDueDate(task.dueDate!);
                  const weekStart = weekDates[0]!;
                  const weekEnd = weekDates[6]!;
                  const effectiveStart = isBefore(start, weekStart) ? weekStart : start;
                  const effectiveDue = isAfter(due, weekEnd) ? weekEnd : due;
                  const startCol = differenceInCalendarDays(effectiveStart, weekStart) + 1;
                  const span = differenceInCalendarDays(effectiveDue, effectiveStart) + 1;
                  return <MultiDayTaskBar key={task.id} task={task} onEdit={onEdit} startCol={startCol} span={span} />;
                })}
              </div>
            )}

            <div className="flex min-h-[calc(100vh-16rem)] w-full flex-row gap-2">
              {weekDates.map((dayDate) => {
                const today = isToday(dayDate);
                const dayISO = format(dayDate, "yyyy-MM-dd");
                const dayTasks = singleDayTasks.filter((task) => {
                  const anchor = task.startDate ?? task.dueDate;
                  return anchor != null && isSameDay(parseTaskDay(anchor), dayDate);
                });

                return (
                  <DroppableColumn key={dayISO} id={dayISO} className="flex min-w-0 flex-1 flex-col gap-1 p-1.5">
                    <div className={cn("flex items-baseline gap-1.5 border-b px-1 pb-1.5", today ? "border-primary/40" : "border-input")}>
                      <span className={cn("text-xs font-semibold tracking-[0.06em] uppercase", today ? "text-primary" : "text-muted-foreground")}>
                        {format(dayDate, "EEE", { locale: es })}
                      </span>
                      <span className={cn("font-display text-xl leading-none font-bold tabular-nums", today ? "text-primary" : "text-foreground")}>
                        {format(dayDate, "d")}
                      </span>
                    </div>

                    {dayTasks.length === 0 ? (
                      <p className="px-1 py-3 text-xs text-muted-foreground">Sin tareas</p>
                    ) : (
                      <div>
                        {dayTasks.map((task) => (
                          <DraggableTaskCard
                            key={task.id}
                            task={task}
                            systemId={systemId}
                            sourceType="day"
                            sourceId={dayISO}
                            compact
                            isFocused={task.id === focusedTaskId}
                            onToggle={onToggle}
                            onDelete={() => onDelete(task)}
                            onEdit={onEdit}
                          />
                        ))}
                      </div>
                    )}
                  </DroppableColumn>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <TaskDragOverlay activeTask={activeTask} systemId={systemId} />
    </DndContext>
  );
}
