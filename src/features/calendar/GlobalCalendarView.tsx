"use client";

import { useState, useMemo } from "react";
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  addDays,
  eachDayOfInterval,
  format,
  isToday,
  startOfToday,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Task } from "@/features/tasks/tasks.types";
import { useCalendarTasks } from "@/features/tasks/tasks.hooks";
import { parseDueDate, dueDateHasTime, parseTaskDay } from "@/features/tasks/tasks.utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { GlobalCalendarMobileView } from "./GlobalCalendarMobileView";

const START_HOUR = 6;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

const PRIORITY_CHIP: Record<string, string> = {
  critical: "bg-red-500/20 border-red-500/40 text-red-700 dark:text-red-400",
  high: "bg-orange-500/20 border-orange-500/40 text-orange-700 dark:text-orange-400",
  medium: "bg-blue-500/20 border-blue-500/40 text-blue-700 dark:text-blue-400",
  low: "bg-neutral-500/20 border-neutral-500/40 text-muted-foreground",
};

function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function TaskChip({ task }: { task: Task }) {
  const timeStr =
    task.dueDate && dueDateHasTime(task.dueDate)
      ? format(parseDueDate(task.dueDate), "HH:mm")
      : null;

  return (
    <div
      className={cn(
        "w-full text-left px-1.5 py-0.5 rounded border text-[11px] leading-tight truncate",
        PRIORITY_CHIP[task.priority ?? "medium"],
      )}
      title={task.title}
    >
      {timeStr && <span className="font-medium">{timeStr} </span>}
      {task.title}
    </div>
  );
}

export function GlobalCalendarView() {
  const today = startOfToday();
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(today, { weekStartsOn: 1 }),
  );
  const [view, setView] = useState<"week" | "day">("week");
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const from = weekStart.toISOString();
  const to = weekEnd.toISOString();
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: allTasks = [] } = useCalendarTasks(from, to);

  const byDayAllDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of allTasks) {
      const dateVal = task.dueDate ?? task.startDate;
      if (!dateVal || dueDateHasTime(dateVal)) continue;
      const key = dayKey(parseTaskDay(dateVal));
      const bucket = map.get(key);
      if (bucket) bucket.push(task);
      else map.set(key, [task]);
    }
    return map;
  }, [allTasks]);

  const byDayHour = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of allTasks) {
      const dateVal = task.dueDate ?? task.startDate;
      if (!dateVal || !dueDateHasTime(dateVal)) continue;
      const d = parseDueDate(dateVal);
      const key = `${dayKey(d)}:${d.getHours()}`;
      const bucket = map.get(key);
      if (bucket) bucket.push(task);
      else map.set(key, [task]);
    }
    return map;
  }, [allTasks]);

  const isMobile = useIsMobile();

  function handleSelectDay(day: Date) {
    setSelectedDay(day);
    const dayWeekStart = startOfWeek(day, { weekStartsOn: 1 });
    if (dayWeekStart.getTime() !== weekStart.getTime()) {
      setWeekStart(dayWeekStart);
    }
  }

  if (isMobile) {
    return (
      <GlobalCalendarMobileView
        selectedDay={selectedDay}
        onSelectDay={handleSelectDay}
        byDayAllDay={byDayAllDay}
        byDayHour={byDayHour}
      />
    );
  }

  function goToday() {
    setWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
    setSelectedDay(today);
  }

  const displayDays = view === "day" ? [selectedDay] : days;
  const colCount = displayDays.length;

  const weekLabel =
    view === "week"
      ? `${format(weekStart, "d MMM", { locale: es })} – ${format(weekEnd, "d MMM yyyy", { locale: es })}`
      : format(selectedDay, "EEEE d 'de' MMMM yyyy", { locale: es });

  return (
    <div className="flex flex-col h-full">
      {/* Navigation bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => {
              if (view === "week") setWeekStart((w) => addWeeks(w, -1));
              else handleSelectDay(addDays(selectedDay, -1));
            }}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToday}>
            Hoy
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => {
              if (view === "week") setWeekStart((w) => addWeeks(w, 1));
              else handleSelectDay(addDays(selectedDay, 1));
            }}
          >
            <ChevronRight className="size-4" />
          </Button>
          <span className="text-sm font-medium capitalize ml-2">{weekLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={view === "week" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("week")}
          >
            Semana
          </Button>
          <Button
            variant={view === "day" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("day")}
          >
            Día
          </Button>
        </div>
      </div>

      {/* Scrollable calendar body */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[480px]">
          {/* Day headers */}
          <div
            className="grid border-b sticky top-0 bg-background z-10"
            style={{ gridTemplateColumns: `56px repeat(${colCount}, 1fr)` }}
          >
            <div className="border-r" />
            {displayDays.map((day) => (
              <button
                key={day.toISOString()}
                type="button"
                className={cn(
                  "py-2 text-center border-r last:border-r-0 transition-colors",
                  view === "week" && "hover:bg-muted/50 cursor-pointer",
                  view === "day" && "cursor-default",
                )}
                onClick={() => {
                  if (view === "week") {
                    setSelectedDay(day);
                    setView("day");
                  }
                }}
              >
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground capitalize">
                  {format(day, "EEE", { locale: es })}
                </div>
                <div
                  className={cn(
                    "text-lg font-medium mt-0.5 size-8 rounded-full flex items-center justify-center mx-auto",
                    isToday(day) && "bg-primary text-primary-foreground",
                  )}
                >
                  {format(day, "d")}
                </div>
              </button>
            ))}
          </div>

          {/* All-day row */}
          <div
            className="grid border-b"
            style={{ gridTemplateColumns: `56px repeat(${colCount}, 1fr)` }}
          >
            <div className="px-1 py-1.5 text-[10px] text-muted-foreground text-right border-r leading-tight flex items-center justify-end">
              <span>Todo el<br />día</span>
            </div>
            {displayDays.map((day) => {
              const tasks = byDayAllDay.get(dayKey(day)) ?? [];
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-r last:border-r-0 p-1 min-h-[32px] space-y-0.5",
                    isToday(day) && "bg-primary/5",
                  )}
                >
                  {tasks.map((t) => (
                    <TaskChip key={t.id} task={t} />
                  ))}
                </div>
              );
            })}
          </div>

          {/* Hour rows */}
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="grid border-b"
              style={{ gridTemplateColumns: `56px repeat(${colCount}, 1fr)` }}
            >
              <div className="px-1 pt-1 text-[10px] text-muted-foreground text-right border-r h-14 leading-none">
                {format(new Date(2000, 0, 1, hour), "HH:mm")}
              </div>
              {displayDays.map((day) => {
                const tasks = byDayHour.get(`${dayKey(day)}:${hour}`) ?? [];
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "border-r last:border-r-0 p-0.5 h-14 space-y-0.5",
                      isToday(day) && "bg-primary/5",
                    )}
                  >
                    {tasks.map((t) => (
                      <TaskChip key={t.id} task={t} />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
