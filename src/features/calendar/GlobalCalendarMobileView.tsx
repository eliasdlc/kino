"use client";

import { addDays, format, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import { parseDueDate } from "@/features/tasks/tasks.utils";

const START_HOUR = 6;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

const PRIORITY_CHIP: Record<string, string> = {
  critical: "bg-red-500/20 border-red-500/40 text-red-700 dark:text-red-400",
  high: "bg-orange-500/20 border-orange-500/40 text-orange-700 dark:text-orange-400",
  medium: "bg-blue-500/20 border-blue-500/40 text-blue-700 dark:text-blue-400",
  low: "bg-neutral-500/20 border-neutral-500/40 text-muted-foreground",
};

interface GlobalCalendarMobileViewProps {
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
  byDayAllDay: Map<string, TaskTransport[]>;
  byDayHour: Map<string, TaskTransport[]>;
}

function dayKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function TimeLabel({ hour }: { hour: number }) {
  return (
    <span className="text-[10px] text-muted-foreground tabular-nums">
      {format(new Date(2000, 0, 1, hour), "HH:mm")}
    </span>
  );
}

export function GlobalCalendarMobileView({
  selectedDay,
  onSelectDay,
  byDayAllDay,
  byDayHour,
}: GlobalCalendarMobileViewProps) {
  const allDayTasks = byDayAllDay.get(dayKey(selectedDay)) ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Day navigation */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Día anterior"
          onClick={() => onSelectDay(addDays(selectedDay, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold capitalize">
            {format(selectedDay, "EEEE", { locale: es })}
          </p>
          <p className={cn(
            "text-xs",
            isToday(selectedDay) ? "text-primary font-medium" : "text-muted-foreground"
          )}>
            {format(selectedDay, "d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Día siguiente"
          onClick={() => onSelectDay(addDays(selectedDay, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* All-day tasks */}
      {allDayTasks.length > 0 && (
        <div className="px-3 py-2 border-b shrink-0 space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            Todo el día
          </p>
          {allDayTasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                "px-2 py-1 rounded border text-xs truncate",
                PRIORITY_CHIP[task.priority ?? "medium"]
              )}
            >
              {task.title}
            </div>
          ))}
        </div>
      )}

      {/* Hour scroll */}
      <div className="flex-1 overflow-y-auto">
        {HOURS.map((hour) => {
          const tasks = byDayHour.get(`${dayKey(selectedDay)}:${hour}`) ?? [];
          return (
            <div key={hour} className="flex gap-2 border-b px-3 py-1.5 min-h-[48px]">
              <div className="w-10 shrink-0 pt-0.5">
                <TimeLabel hour={hour} />
              </div>
              <div className="flex-1 space-y-0.5">
                {tasks.map((task) => {
                  const timeStr = task.dueDate
                    ? format(parseDueDate(task.dueDate), "HH:mm")
                    : null;
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "px-1.5 py-0.5 rounded border text-xs truncate",
                        PRIORITY_CHIP[task.priority ?? "medium"]
                      )}
                    >
                      {timeStr && <span className="font-medium">{timeStr} </span>}
                      {task.title}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
