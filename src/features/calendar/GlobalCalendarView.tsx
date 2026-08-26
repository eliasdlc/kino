"use client";

import { useState, useMemo, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
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
import type { TaskTransport } from "@/features/tasks/tasks.types";
import { useCalendarTasks, useUpdateCalendarTask, useAllTasks } from "@/features/tasks/tasks.hooks";
import { dayToLocalISO } from "@/features/tasks/tasks.utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { GlobalCalendarMobileView } from "./GlobalCalendarMobileView";
import type { TaskDragData } from "@/features/tasks/dnd/dnd.types";
import { useTodayEnergyPlan } from "@/features/energy/energy.hooks";
import {
  HOURS,
  ROW_HEIGHT,
  TOTAL_HEIGHT,
  dayKey,
  groupTasksByDay,
  minutesToTimeString,
  occupiedHoursForDay,
  resizedMinutes,
  suggestHour,
} from "./calendar.layout";
import {
  AllDayCell,
  DroppableSlot,
  PRIORITY_CHIP,
  TaskBlock,
  UnscheduledChip,
} from "./CalendarBlocks";

export function GlobalCalendarView() {
  const today = startOfToday();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, { weekStartsOn: 1 }));
  const [view, setView] = useState<"week" | "day">("week");
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [activeTask, setActiveTask] = useState<TaskTransport | null>(null);
  const [resizeInfo, setResizeInfo] = useState<{
    task: TaskTransport;
    startY: number;
    startMinutes: number;
    currentMinutes: number;
  } | null>(null);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const from = weekStart.toISOString();
  const to = weekEnd.toISOString();
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: calendarTasks = [] } = useCalendarTasks(from, to);
  const { data: allTasks = [] } = useAllTasks();
  const { mutate: updateTask } = useUpdateCalendarTask(from, to);
  const { data: energyPlan } = useTodayEnergyPlan();
  const projectedCurve = energyPlan?.projectedCurve ?? [];

  const unscheduledTasks = useMemo(
    () =>
      allTasks.filter(
        (t) =>
          !t.dueDate &&
          !t.startDate &&
          t.status !== "done" &&
          t.status !== "archived" &&
          !t.deletedAt,
      ),
    [allTasks],
  );

  const occupiedHoursForSelectedDay = useMemo(
    () => occupiedHoursForDay(calendarTasks, selectedDay),
    [calendarTasks, selectedDay],
  );

  function handleAcceptSuggestion(task: TaskTransport, hour: number) {
    const date = dayKey(selectedDay);
    const newDate = dayToLocalISO(date, `${hour.toString().padStart(2, "0")}:00`);
    updateTask({ taskId: task.id, data: { startDate: newDate } });
  }

  const byDayAllDay = useMemo(
    () => groupTasksByDay(calendarTasks, { timed: false }),
    [calendarTasks],
  );

  const timedByDay = useMemo(
    () => groupTasksByDay(calendarTasks, { timed: true }),
    [calendarTasks],
  );

  // Pointer-based resize tracking
  useEffect(() => {
    if (!resizeInfo) return;

    function onMove(e: PointerEvent) {
      setResizeInfo((prev) =>
        prev ? { ...prev, currentMinutes: resizedMinutes(prev.startMinutes, e.clientY - prev.startY) } : null,
      );
    }

    function onUp(e: PointerEvent) {
      setResizeInfo((prev) => {
        if (!prev) return null;
        const newMinutes = resizedMinutes(prev.startMinutes, e.clientY - prev.startY);
        if (newMinutes !== prev.startMinutes) {
          updateTask({
            taskId: prev.task.id,
            data: { estimatedTime: minutesToTimeString(newMinutes) },
          });
        }
        return null;
      });
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [resizeInfo, updateTask]);

  const isMobile = useIsMobile();

  function handleSelectDay(day: Date) {
    setSelectedDay(day);
    const newWeekStart = startOfWeek(day, { weekStartsOn: 1 });
    if (newWeekStart.getTime() !== weekStart.getTime()) setWeekStart(newWeekStart);
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } }),
  );

  function handleDragStart({ active }: DragStartEvent) {
    const data = active.data.current as TaskDragData | undefined;
    setActiveTask(data?.task ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null);
    if (!over) return;

    const data = active.data.current as TaskDragData | undefined;
    if (!data?.task) return;

    const overId = over.id as string;

    if (overId.startsWith("slot:")) {
      // "slot:2026-06-20:14"
      const parts = overId.split(":");
      const date = parts[1]!;
      const hour = parseInt(parts[2]!, 10);
      const newDate = dayToLocalISO(date, `${hour.toString().padStart(2, "0")}:00`);
      updateTask({ taskId: data.task.id, data: { startDate: newDate } });
    } else if (overId.startsWith("allday:")) {
      // "allday:2026-06-20"
      const date = overId.slice("allday:".length);
      updateTask({ taskId: data.task.id, data: { startDate: null, dueDate: dayToLocalISO(date) } });
    }
  }

  if (isMobile) {
    return (
      <GlobalCalendarMobileView
        selectedDay={selectedDay}
        onSelectDay={handleSelectDay}
        byDayAllDay={byDayAllDay}
        byDayHour={timedByDay}
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
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full">
        {/* Unscheduled panel */}
        <div className="w-44 shrink-0 border-r flex flex-col overflow-hidden">
          <div className="px-2 pt-3 pb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium shrink-0">
            Sin programar
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {unscheduledTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground/50 text-center py-4">
                Nada pendiente
              </p>
            ) : (
              unscheduledTasks.map((task) => (
                <UnscheduledChip
                  key={task.id}
                  task={task}
                  suggestedHour={
                    projectedCurve.length === 24
                      ? suggestHour(task.energyLevel ?? "medium", projectedCurve, occupiedHoursForSelectedDay)
                      : null
                  }
                  onAcceptSuggestion={handleAcceptSuggestion}
                />
              ))
            )}
          </div>
        </div>

        {/* Calendar main */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Navigation bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={view === "week" ? "Semana anterior" : "Día anterior"}
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
                aria-label={view === "week" ? "Semana siguiente" : "Día siguiente"}
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

          {/* Calendar scroll area */}
          <div className="flex-1 overflow-auto">
            <div className="min-w-[400px]">
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
                  <span>
                    Todo el
                    <br />
                    día
                  </span>
                </div>
                {displayDays.map((day) => (
                  <AllDayCell
                    key={day.toISOString()}
                    day={day}
                    tasks={byDayAllDay.get(dayKey(day)) ?? []}
                  />
                ))}
              </div>

              {/* Time grid */}
              <div
                className="grid"
                style={{ gridTemplateColumns: `56px repeat(${colCount}, 1fr)` }}
              >
                {/* Time gutter */}
                <div className="border-r" style={{ height: TOTAL_HEIGHT }}>
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="flex items-start justify-end pr-1 pt-1 text-[10px] text-muted-foreground border-t border-border/40 first:border-t-0"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {format(new Date(2000, 0, 1, hour), "HH:mm")}
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {displayDays.map((day) => {
                  const timedTasks = timedByDay.get(dayKey(day)) ?? [];
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "relative border-r last:border-r-0",
                        isToday(day) && "bg-primary/5",
                      )}
                      style={{ height: TOTAL_HEIGHT }}
                    >
                      {/* Droppable slots for each hour (energy overlay only in day view) */}
                      {HOURS.map((hour) => (
                        <DroppableSlot
                          key={hour}
                          id={`slot:${dayKey(day)}:${hour}`}
                          hour={hour}
                          energyCapacity={
                            view === "day" && projectedCurve.length === 24
                              ? (projectedCurve[hour] ?? undefined)
                              : undefined
                          }
                        />
                      ))}

                      {/* TaskTransport blocks (absolutely positioned) */}
                      {timedTasks.map((task) => (
                        <TaskBlock
                          key={task.id}
                          task={task}
                          overrideDuration={
                            resizeInfo?.task.id === task.id
                              ? resizeInfo.currentMinutes
                              : undefined
                          }
                          onResizeStart={(e, t, startMinutes) => {
                            e.currentTarget.setPointerCapture(e.pointerId);
                            setResizeInfo({ task: t, startY: e.clientY, startMinutes, currentMinutes: startMinutes });
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask && (
          <div
            className={cn(
              "px-2 py-1 rounded border text-xs font-medium shadow-lg rotate-1 opacity-90 max-w-[180px] truncate",
              PRIORITY_CHIP[activeTask.priority ?? "medium"],
            )}
          >
            {activeTask.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
