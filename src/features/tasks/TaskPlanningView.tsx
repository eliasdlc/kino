"use client";

import { useMemo, useState, useCallback } from "react";
import {
  addDays,
  addWeeks,
  format,
  getISOWeek,
  isSameDay,
  isToday,
  parseISO,
  startOfWeek,
} from "date-fns";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { DraggableTaskCard } from "./dnd/DraggableTaskCard";
import { DroppableColumn } from "./dnd/DroppableColumn";
import { TaskDragOverlay } from "./dnd/TaskDragOverlay";
import type { TaskDragData } from "./dnd/dnd.types";
import { useTasks, useFolderTasks, useToggleTask, useDeleteTask, useUpdateTask } from "./tasks.hooks";
import type { Task } from "./tasks.types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTaskKeyboardNavigation } from "./useTaskKeyboardNavigation";

interface TaskPlanningViewProps {
  systemId: string;
  initialData: Task[];
  folderId?: string;
  folderInitialData?: Task[];
  onEdit?: (task: Task) => void;
  keyboardDisabled?: boolean;
}

export function TaskPlanningView({ systemId, initialData, folderId, folderInitialData, onEdit, keyboardDisabled }: TaskPlanningViewProps) {
  // Use folder-scoped or system-scoped tasks depending on context
  const systemQuery = useTasks(systemId, initialData);
  const folderQuery = useFolderTasks(systemId, folderId ?? "", folderInitialData);
  const { data: tasks = [] } = folderId ? folderQuery : systemQuery;

  const { mutate: toggleTask } = useToggleTask(systemId, folderId);
  const { mutate: deleteTask } = useDeleteTask(systemId, folderId);
  const { mutate: updateTask } = useUpdateTask(systemId);

  // Track the currently dragged task for the DragOverlay
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Week navigation: 0 = current week, 1 = next, -1 = previous
  const [weekOffset, setWeekOffset] = useState(0);

  // Sensors: pointer for mouse/touch, keyboard for a11y
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 8px activation distance prevents accidental drags on click
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  const weekDates = useMemo(() => {
    const baseDate = addWeeks(new Date(), weekOffset);
    const monday = startOfWeek(baseDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [weekOffset]);

  const weekNumber = useMemo(() => getISOWeek(weekDates[0]!), [weekDates]);

  const monthHeading = useMemo(() => {
    const start = weekDates[0]!;
    const end = weekDates[weekDates.length - 1]!;
    const sameMonth =
      start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (sameMonth) {
      return format(start, "LLLL yyyy");
    }
    return `${format(start, "LLLL")} – ${format(end, "LLLL yyyy")}`;
  }, [weekDates]);

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.startDate || task.status === "done" || task.status === "archived") return false;
      const date = parseISO(task.startDate);
      return weekDates.some((wd) => isSameDay(wd, date));
    });
  }, [tasks, weekDates]);

  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const { focusedTaskId } = useTaskKeyboardNavigation(visibleTasks, {
    onSelect: onEdit,
    onToggle: toggleTask,
    onDelete: setDeleteTarget,
  }, {
    enabled: !keyboardDisabled && deleteTarget === null
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as TaskDragData | undefined;
    if (data?.task) {
      setActiveTask(data.task);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null);

      const { active, over } = event;
      if (!over) return; // Dropped outside any droppable — no-op

      const data = active.data.current as TaskDragData | undefined;
      if (!data) return;

      const targetId = over.id as string;

      // Same column — no-op
      if (targetId === data.sourceId) return;

      updateTask({
        taskId: data.task.id,
        data: { startDate: targetId },
      });
    },
    [updateTask]
  );

  const handleDragCancel = useCallback(() => {
    setActiveTask(null);
  }, []);

  return (
    <DndContext
      id="task-planning-dnd"
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col gap-4">
        {/* Week navigation header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setWeekOffset((v) => v - 1)}
              aria-label="Previous week"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <h2 className="text-2xl font-bold capitalize">
              {monthHeading}
              <span className="text-base font-normal text-muted-foreground ml-2">
                — Week {weekNumber}
              </span>
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setWeekOffset((v) => v + 1)}
              aria-label="Next week"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {weekOffset !== 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset(0)}
            >
              This week
            </Button>
          )}
        </div>

        <div className="flex flex-row gap-2 w-full h-full overflow-x-auto">
          {weekDates.map((dayDate) => {
            const today = isToday(dayDate);
            const dayISO = format(dayDate, "yyyy-MM-dd");
            const dayTasks = tasks.filter(
              (task) =>
                task.startDate &&
                isSameDay(parseISO(task.startDate), dayDate) &&
                task.status !== "done" &&
                task.status !== "archived"
            );

            return (
              <DroppableColumn
                key={dayISO}
                id={dayISO}
                className={`flex flex-col gap-1.5 flex-1 min-w-0 p-2 ${
                  today ? "bg-primary/5 ring-1 ring-primary/20" : ""
                }`}
              >
                {/* Day header */}
                <div
                  className={`flex items-baseline gap-1.5 px-1 pb-1.5 border-b ${
                    today ? "border-primary/30" : "border-border"
                  }`}
                >
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider ${
                      today ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {format(dayDate, "EEE")}
                  </span>
                  <span
                    className={`text-xl font-bold leading-none ${
                      today ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {format(dayDate, "d")}
                  </span>
                </div>

                {/* Tasks */}
                <div className="flex flex-col gap-1.5">
                  {dayTasks.length === 0 ? (
                    <div className="flex justify-center py-3 opacity-30">
                      <span className="text-xs text-muted-foreground">—</span>
                    </div>
                  ) : (
                    dayTasks.map((task) => (
                      <DraggableTaskCard
                        key={task.id}
                        task={task}
                        systemId={systemId}
                        sourceType="day"
                        sourceId={dayISO}
                        isFocused={task.id === focusedTaskId}
                        onToggle={(id) => toggleTask(id)}
                        onDelete={() => setDeleteTarget(task)}
                        onEdit={onEdit}
                      />
                    ))
                  )}
                </div>
              </DroppableColumn>
            );
          })}
        </div>
      </div>

      {/* Floating drag preview — rendered in a portal, follows cursor */}
      <TaskDragOverlay activeTask={activeTask} systemId={systemId} />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Move to trash"
        description={`"${deleteTarget?.title}" will be moved to the trash.`}
        confirmLabel="Move to trash"
        onConfirm={() => {
          if (deleteTarget) deleteTask(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </DndContext>
  );
}
