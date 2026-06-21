"use client";

import { useState, useMemo, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
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
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Task } from "@/features/tasks/tasks.types";
import { useCalendarTasks, useUpdateCalendarTask, useAllTasks } from "@/features/tasks/tasks.hooks";
import { parseDueDate, dueDateHasTime, parseTaskDay, dayToLocalISO } from "@/features/tasks/tasks.utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { GlobalCalendarMobileView } from "./GlobalCalendarMobileView";
import type { TaskDragData } from "@/features/tasks/dnd/dnd.types";
import { useTodayEnergyPlan } from "@/features/energy/energy.hooks";

const ROW_HEIGHT = 56; // px per hour
const START_HOUR = 6;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const TOTAL_HEIGHT = HOURS.length * ROW_HEIGHT;

const PRIORITY_CHIP: Record<string, string> = {
  critical: "bg-red-500/20 border-red-500/40 text-red-700 dark:text-red-400",
  high: "bg-orange-500/20 border-orange-500/40 text-orange-700 dark:text-orange-400",
  medium: "bg-blue-500/20 border-blue-500/40 text-blue-700 dark:text-blue-400",
  low: "bg-neutral-500/20 border-neutral-500/40 text-muted-foreground",
};

function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function parseEstimatedMinutes(time: string | null | undefined): number {
  if (!time) return 60;
  const parts = time.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Energy level 0–100 → bg color class for overlay */
function energyBgClass(capacity: number): string {
  if (capacity >= 60) return "bg-emerald-500/8";
  if (capacity >= 30) return "bg-amber-500/8";
  return "bg-rose-500/8";
}

/** Pick the best unoccupied hour for a task's energyLevel from projectedCurve */
function suggestHour(
  energyLevel: string,
  curve: number[],
  occupiedHours: Set<number>,
): number | null {
  let bestHour: number | null = null;
  let bestScore = -Infinity;
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    if (occupiedHours.has(h)) continue;
    const cap = curve[h] ?? 0;
    const score =
      energyLevel === "high" ? cap
      : energyLevel === "low" ? -cap
      : -(Math.abs(cap - 50)); // medium → closest to 50%
    if (score > bestScore) { bestScore = score; bestHour = h; }
  }
  return bestHour;
}

/** Preferred placement date: timed startDate > dueDate > startDate (no time) */
function getPlacementDate(task: Task): string | null {
  if (task.startDate && dueDateHasTime(task.startDate)) return task.startDate;
  if (task.dueDate) return task.dueDate;
  return task.startDate ?? null;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function AllDayCell({ day, tasks }: { day: Date; tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `allday:${dayKey(day)}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-r last:border-r-0 p-1 min-h-[32px] space-y-0.5 transition-colors",
        isOver && "bg-primary/10",
        isToday(day) && "bg-primary/5",
      )}
    >
      {tasks.map((t) => (
        <div
          key={t.id}
          className={cn(
            "px-1.5 py-0.5 rounded border text-[11px] truncate",
            PRIORITY_CHIP[t.priority ?? "medium"],
          )}
        >
          {t.title}
        </div>
      ))}
    </div>
  );
}

function DroppableSlot({ id, hour, energyCapacity }: { id: string; hour: number; energyCapacity?: number }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute w-full border-t border-border/40 transition-colors",
        isOver && "bg-primary/15",
        hour % 2 === 0 ? "border-border/40" : "border-border/20",
        energyCapacity !== undefined && !isOver && energyBgClass(energyCapacity),
      )}
      style={{ top: (hour - START_HOUR) * ROW_HEIGHT, height: ROW_HEIGHT }}
    />
  );
}

interface TaskBlockProps {
  task: Task;
  overrideDuration?: number;
  onResizeStart: (e: React.PointerEvent, task: Task, startMinutes: number) => void;
}

function TaskBlock({ task, overrideDuration, onResizeStart }: TaskBlockProps) {
  const placementDate = getPlacementDate(task);
  const d = placementDate ? parseDueDate(placementDate) : null;
  if (!d) return null;

  const topOffset = (d.getHours() - START_HOUR + d.getMinutes() / 60) * ROW_HEIGHT;
  const estimatedMinutes = overrideDuration ?? parseEstimatedMinutes(task.estimatedTime);
  const blockHeight = Math.max(24, (estimatedMinutes / 60) * ROW_HEIGHT);

  const dragData: TaskDragData = { task, sourceType: "calendar", sourceId: dayKey(d) };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `cal:${task.id}`,
    data: dragData,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "absolute left-0.5 right-0.5 rounded border px-1.5 pt-0.5 pb-2 text-[11px] leading-tight select-none cursor-grab active:cursor-grabbing overflow-hidden",
        PRIORITY_CHIP[task.priority ?? "medium"],
        isDragging && "opacity-30",
      )}
      style={{ top: topOffset, height: blockHeight }}
      title={task.title}
    >
      <span className="font-medium">{format(d, "HH:mm")} </span>
      <span className="truncate">{task.title}</span>
      {/* Resize handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2.5 cursor-row-resize flex items-center justify-center opacity-40 hover:opacity-80"
        onPointerDown={(e) => {
          e.stopPropagation(); // don't trigger drag
          onResizeStart(e, task, estimatedMinutes);
        }}
      >
        <GripVertical className="size-2.5 rotate-90" />
      </div>
    </div>
  );
}

function UnscheduledChip({
  task,
  suggestedHour,
  onAcceptSuggestion,
}: {
  task: Task;
  suggestedHour: number | null;
  onAcceptSuggestion: (task: Task, hour: number) => void;
}) {
  const dragData: TaskDragData = { task, sourceType: "unscheduled", sourceId: "unscheduled" };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `unscheduled:${task.id}`,
    data: dragData,
  });
  return (
    <div
      className={cn(
        "rounded border text-xs select-none",
        PRIORITY_CHIP[task.priority ?? "medium"],
        isDragging && "opacity-30",
      )}
    >
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className="px-2 py-1 truncate cursor-grab active:cursor-grabbing"
        title={task.title}
      >
        {task.title}
      </div>
      {suggestedHour !== null && (
        <button
          type="button"
          className="w-full text-left px-2 pb-1 text-[10px] text-primary/80 hover:text-primary flex items-center gap-1 leading-tight"
          onClick={() => onAcceptSuggestion(task, suggestedHour)}
        >
          <span>Kino sugiere {format(new Date(2000, 0, 1, suggestedHour), "HH:mm")}</span>
          <span className="text-primary/50">→</span>
        </button>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function GlobalCalendarView() {
  const today = startOfToday();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, { weekStartsOn: 1 }));
  const [view, setView] = useState<"week" | "day">("week");
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [resizeInfo, setResizeInfo] = useState<{
    task: Task;
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

  // Hours already occupied in the selected day (for suggestion avoidance)
  const occupiedHoursForSelectedDay = useMemo(() => {
    const set = new Set<number>();
    const key = dayKey(selectedDay);
    for (const task of calendarTasks) {
      const dateVal = getPlacementDate(task);
      if (!dateVal || !dueDateHasTime(dateVal)) continue;
      const d = parseDueDate(dateVal);
      if (dayKey(d) === key) set.add(d.getHours());
    }
    return set;
  }, [calendarTasks, selectedDay]);

  function handleAcceptSuggestion(task: Task, hour: number) {
    const date = dayKey(selectedDay);
    const newDate = dayToLocalISO(date, `${hour.toString().padStart(2, "0")}:00`);
    updateTask({ taskId: task.id, data: { startDate: newDate } });
  }

  const byDayAllDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of calendarTasks) {
      const dateVal = getPlacementDate(task);
      if (!dateVal || dueDateHasTime(dateVal)) continue;
      const key = dayKey(parseTaskDay(dateVal));
      const bucket = map.get(key);
      if (bucket) bucket.push(task);
      else map.set(key, [task]);
    }
    return map;
  }, [calendarTasks]);

  const timedByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of calendarTasks) {
      const dateVal = getPlacementDate(task);
      if (!dateVal || !dueDateHasTime(dateVal)) continue;
      const key = dayKey(parseDueDate(dateVal));
      const bucket = map.get(key);
      if (bucket) bucket.push(task);
      else map.set(key, [task]);
    }
    return map;
  }, [calendarTasks]);

  // Pointer-based resize tracking
  useEffect(() => {
    if (!resizeInfo) return;

    function onMove(e: PointerEvent) {
      setResizeInfo((prev) => {
        if (!prev) return null;
        const deltaY = e.clientY - prev.startY;
        const deltaMinutes = Math.round((deltaY / ROW_HEIGHT) * 60 / 15) * 15;
        return { ...prev, currentMinutes: Math.max(15, prev.startMinutes + deltaMinutes) };
      });
    }

    function onUp(e: PointerEvent) {
      setResizeInfo((prev) => {
        if (!prev) return null;
        const deltaY = e.clientY - prev.startY;
        const deltaMinutes = Math.round((deltaY / ROW_HEIGHT) * 60 / 15) * 15;
        const newMinutes = Math.max(15, prev.startMinutes + deltaMinutes);
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

                      {/* Task blocks (absolutely positioned) */}
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
