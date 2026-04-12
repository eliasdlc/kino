"use client";

import { useMemo } from "react";
import { addDays, format, isSameDay, isToday, parseISO, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { TaskCard } from "./TaskCard";
import { useTasks, useToggleTask, useDeleteTask } from "./tasks.hooks";
import type { Task } from "./tasks.types";

interface TaskPlanningViewProps {
  systemId: string;
  initialData: Task[];
}

export function TaskPlanningView({ systemId, initialData }: TaskPlanningViewProps) {
  const { data: tasks = [] } = useTasks(systemId, initialData);
  const { mutate: toggleTask } = useToggleTask(systemId);
  const { mutate: deleteTask } = useDeleteTask(systemId);

  const weekDates = useMemo(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 6 }, (_, i) => addDays(monday, i));
  }, []);

  const monthHeading = useMemo(() => {
    const start = weekDates[0]!;
    const end = weekDates[weekDates.length - 1]!;
    const sameMonth =
      start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (sameMonth) {
      return format(start, "LLLL yyyy", { locale: es });
    }
    return `${format(start, "LLLL", { locale: es })} – ${format(end, "LLLL yyyy", { locale: es })}`;
  }, [weekDates]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold capitalize">{monthHeading}</h2>
      <div className="flex flex-row gap-2 w-full h-full">
      {weekDates.map((dayDate) => {
        const today = isToday(dayDate);
        const dayTasks = tasks.filter(
          (task) => task.startDate && isSameDay(parseISO(task.startDate), dayDate) && task.status !== "done" && task.status !== "archived"
        );

        return (
          <div
            key={dayDate.toISOString()}
            className={`flex flex-col gap-1.5 flex-1 min-w-0 rounded-lg p-2 transition-colors ${
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
                <p className="text-xs text-muted-foreground/40 text-center py-3">—</p>
              ) : (
                dayTasks.filter((task) => task.status !== "done" && task.status !== "archived").map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    systemId={systemId}
                    onToggle={(id) => toggleTask(id)}
                    onDelete={(id) => deleteTask(id)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}
