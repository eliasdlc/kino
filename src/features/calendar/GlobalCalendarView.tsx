"use client";

import { useState, useMemo, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
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
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import { useCalendarTasks, useUpdateCalendarTask, useAllTasks } from "@/features/tasks/tasks.hooks";
import { dayToLocalISO } from "@/features/tasks/tasks.utils";
import { TaskDetailSheet } from "@/features/tasks/TaskDetailSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { GlobalCalendarMobileView } from "./GlobalCalendarMobileView";
import { ProgramarSheet, type Programacion } from "./ProgramarSheet";
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

const VISTAS = [
  { value: "week", label: "Semana" },
  { value: "day", label: "Día" },
] as const;

type Vista = (typeof VISTAS)[number]["value"];

/** Lo que las dos vistas leen: el mismo cálculo, para que no puedan discrepar. */
interface DatosDelCalendario {
  byDayAllDay: Map<string, TaskTransport[]>;
  timedByDay: Map<string, TaskTransport[]>;
  unscheduledTasks: TaskTransport[];
  /** La hora libre que mejor va con la energía de una tarea, o nada sin curva. */
  sugerencia: (task: TaskTransport) => number | null;
}

/**
 * El calendario global. El teléfono y el escritorio son dos componentes
 * hermanos, no una rama dentro del mismo render: el teléfono no monta el
 * contexto de arrastre ni los 119 huecos soltables, y la rama se decide antes
 * que ellos (`useIsMobile` lee el viewport en el render). Los datos, el detalle
 * de la tarea y la hoja de programar son de los dos.
 */
export function GlobalCalendarView() {
  const today = startOfToday();
  const isMobile = useIsMobile();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, { weekStartsOn: 1 }));
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [abierta, setAbierta] = useState<TaskTransport | null>(null);
  const [programando, setProgramando] = useState<TaskTransport | null>(null);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const from = weekStart.toISOString();
  const to = weekEnd.toISOString();

  const { data: calendarTasks = [] } = useCalendarTasks(from, to);
  const { data: allTasks = [] } = useAllTasks();
  const { mutate: updateTask } = useUpdateCalendarTask(from, to);
  const { data: energyPlan } = useTodayEnergyPlan();
  const projectedCurve = energyPlan?.projectedCurve;

  const unscheduledTasks = useMemo(
    () => allTasks.filter((t) => !t.dueDate && !t.startDate && t.status !== "done" && !t.deletedAt),
    [allTasks],
  );
  const byDayAllDay = useMemo(() => groupTasksByDay(calendarTasks, { timed: false }), [calendarTasks]);
  const timedByDay = useMemo(() => groupTasksByDay(calendarTasks, { timed: true }), [calendarTasks]);
  const ocupadas = useMemo(() => occupiedHoursForDay(calendarTasks, selectedDay), [calendarTasks, selectedDay]);

  const datos: DatosDelCalendario = {
    byDayAllDay,
    timedByDay,
    unscheduledTasks,
    sugerencia: (task) =>
      projectedCurve?.length === 24 ? suggestHour(task.energyLevel ?? "medium", projectedCurve, ocupadas) : null,
  };

  function handleSelectDay(day: Date) {
    setSelectedDay(day);
    const newWeekStart = startOfWeek(day, { weekStartsOn: 1 });
    if (newWeekStart.getTime() !== weekStart.getTime()) setWeekStart(newWeekStart);
  }

  /** La misma escritura que soltar en un hueco (con hora) o en "Todo el día" (sin ella). */
  function programar(task: TaskTransport, { hour }: Programacion) {
    const dia = dayKey(selectedDay);
    if (hour === null) {
      updateTask({ taskId: task.id, data: { startDate: null, dueDate: dayToLocalISO(dia) } });
    } else {
      updateTask({ taskId: task.id, data: { startDate: dayToLocalISO(dia, `${hour.toString().padStart(2, "0")}:00`) } });
    }
  }

  return (
    <>
      {isMobile ? (
        <GlobalCalendarMobileView
          selectedDay={selectedDay}
          onSelectDay={handleSelectDay}
          byDayAllDay={byDayAllDay}
          timedByDay={timedByDay}
          unscheduledTasks={unscheduledTasks}
          onProgramar={setProgramando}
          onOpenTask={setAbierta}
        />
      ) : (
        <CalendarioEscritorio
          datos={datos}
          weekStart={weekStart}
          onWeekStart={setWeekStart}
          selectedDay={selectedDay}
          onSelectDay={handleSelectDay}
          projectedCurve={projectedCurve ?? []}
          onUpdate={updateTask}
          onProgramar={setProgramando}
          onOpenTask={setAbierta}
          onAcceptSuggestion={(task, hour) => programar(task, { hour })}
        />
      )}

      <ProgramarSheet
        task={programando}
        day={selectedDay}
        open={programando !== null}
        onOpenChange={(next) => !next && setProgramando(null)}
        suggestedHour={programando ? datos.sugerencia(programando) : null}
        onSchedule={programar}
      />
      <TaskDetailSheet
        task={abierta}
        systemId={abierta?.systemId ?? ""}
        open={abierta !== null}
        onOpenChange={(next) => !next && setAbierta(null)}
      />
    </>
  );
}

type UpdateCalendarTask = ReturnType<typeof useUpdateCalendarTask>["mutate"];

interface CalendarioEscritorioProps {
  datos: DatosDelCalendario;
  weekStart: Date;
  onWeekStart: (updater: (week: Date) => Date) => void;
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
  projectedCurve: number[];
  onUpdate: UpdateCalendarTask;
  onProgramar: (task: TaskTransport) => void;
  onOpenTask: (task: TaskTransport) => void;
  onAcceptSuggestion: (task: TaskTransport, hour: number) => void;
}

/**
 * La rejilla de escritorio: semana o día, con arrastre de ratón entre huecos y
 * redimensionar por el tirador. El arrastre sólo escucha al ratón: con el dedo
 * (una tableta pasa de 768 px) se programa por la hoja y se abre por el bloque.
 */
function CalendarioEscritorio({
  datos,
  weekStart,
  onWeekStart,
  selectedDay,
  onSelectDay,
  projectedCurve,
  onUpdate,
  onProgramar,
  onOpenTask,
  onAcceptSuggestion,
}: CalendarioEscritorioProps) {
  const today = startOfToday();
  const [view, setView] = useState<Vista>("week");
  const [activeTask, setActiveTask] = useState<TaskTransport | null>(null);
  const [resizeInfo, setResizeInfo] = useState<{
    task: TaskTransport;
    startY: number;
    startMinutes: number;
    currentMinutes: number;
  } | null>(null);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const { byDayAllDay, timedByDay, unscheduledTasks, sugerencia } = datos;

  // El tirador de redimensionar sigue al puntero hasta soltar.
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
          onUpdate({ taskId: prev.task.id, data: { estimatedTime: minutesToTimeString(newMinutes) } });
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
  }, [resizeInfo, onUpdate]);

  // Sólo el ratón arrastra: en táctil la operación con nombre es la hoja.
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }));

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
      onUpdate({ taskId: data.task.id, data: { startDate: newDate } });
    } else if (overId.startsWith("allday:")) {
      // "allday:2026-06-20"
      const date = overId.slice("allday:".length);
      onUpdate({ taskId: data.task.id, data: { startDate: null, dueDate: dayToLocalISO(date) } });
    }
  }

  function goToday() {
    onWeekStart(() => startOfWeek(today, { weekStartsOn: 1 }));
    onSelectDay(today);
  }

  const displayDays = view === "day" ? [selectedDay] : days;
  const colCount = displayDays.length;

  const weekLabel =
    view === "week"
      ? `${format(weekStart, "d MMM", { locale: es })} al ${format(weekEnd, "d MMM yyyy", { locale: es })}`
      : format(selectedDay, "EEEE d 'de' MMMM yyyy", { locale: es });

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full">
        {/* Sin programar */}
        <section aria-labelledby="cal-sin-programar-escritorio" className="flex w-52 shrink-0 flex-col overflow-hidden border-r border-border">
          <h2
            id="cal-sin-programar-escritorio"
            className="shrink-0 px-3 pt-4 pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground"
          >
            Sin programar
          </h2>
          <div className="flex-1 space-y-1.5 overflow-y-auto px-2 pb-2">
            {unscheduledTasks.length === 0 ? (
              <p className="px-1 py-4 text-sm text-muted-foreground">Todo lo pendiente ya tiene fecha.</p>
            ) : (
              unscheduledTasks.map((task) => (
                <UnscheduledChip
                  key={task.id}
                  task={task}
                  suggestedHour={sugerencia(task)}
                  onAcceptSuggestion={onAcceptSuggestion}
                  onProgramar={onProgramar}
                />
              ))
            )}
          </div>
        </section>

        {/* El calendario */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
            <div className="flex min-w-0 items-center gap-1">
              <h1 className="mr-3 font-display text-[1.41rem] font-bold tracking-[-0.02em]">Calendario</h1>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={view === "week" ? "Semana anterior" : "Día anterior"}
                onClick={() => {
                  if (view === "week") onWeekStart((w) => addWeeks(w, -1));
                  else onSelectDay(addDays(selectedDay, -1));
                }}
              >
                <ChevronLeft />
              </Button>
              <Button variant="secondary" size="sm" onClick={goToday}>
                Hoy
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={view === "week" ? "Semana siguiente" : "Día siguiente"}
                onClick={() => {
                  if (view === "week") onWeekStart((w) => addWeeks(w, 1));
                  else onSelectDay(addDays(selectedDay, 1));
                }}
              >
                <ChevronRight />
              </Button>
              <span className="ml-2 truncate text-sm font-semibold text-body first-letter:uppercase">{weekLabel}</span>
            </div>
            <Segmented aria-label="Vista" value={view} onValueChange={setView} options={VISTAS} />
          </div>

          <div className="flex-1 overflow-auto">
            <div className="min-w-[400px]">
              {/* Cabeceras de día */}
              <div
                className="sticky top-0 z-(--z-raised) grid border-b border-border bg-background"
                style={{ gridTemplateColumns: `3.3rem repeat(${colCount}, minmax(0, 1fr))` }}
              >
                <div className="border-r border-border" />
                {displayDays.map((day) => (
                  <button
                    key={day.toISOString()}
                    type="button"
                    aria-current={isToday(day) ? "date" : undefined}
                    disabled={view === "day"}
                    className="focus-ring border-r border-border py-2 text-center transition-colors duration-(--dur-toque) ease-(--ease-pluma) last:border-r-0 enabled:cursor-pointer enabled:hover:bg-sf2/60"
                    onClick={() => {
                      onSelectDay(day);
                      setView("day");
                    }}
                  >
                    <span className="block text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      {format(day, "EEE", { locale: es })}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block font-display text-lg font-bold tabular-nums",
                        isToday(day) && "text-primary",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </button>
                ))}
              </div>

              {/* Todo el día */}
              <div className="grid border-b border-border" style={{ gridTemplateColumns: `3.3rem repeat(${colCount}, minmax(0, 1fr))` }}>
                <div className="flex items-center justify-end border-r border-border px-1 py-1.5 text-right text-xs leading-tight text-muted-foreground">
                  Todo el día
                </div>
                {displayDays.map((day) => (
                  <AllDayCell
                    key={day.toISOString()}
                    day={day}
                    tasks={byDayAllDay.get(dayKey(day)) ?? []}
                    onOpenTask={onOpenTask}
                  />
                ))}
              </div>

              {/* Rejilla de horas */}
              <div className="grid" style={{ gridTemplateColumns: `3.3rem repeat(${colCount}, minmax(0, 1fr))` }}>
                <div className="border-r border-border" style={{ height: TOTAL_HEIGHT }}>
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="flex items-start justify-end border-t border-border/40 pt-1 pr-1 text-xs text-muted-foreground tabular-nums first:border-t-0"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {format(new Date(2000, 0, 1, hour), "HH:mm")}
                    </div>
                  ))}
                </div>

                {displayDays.map((day) => {
                  const timedTasks = timedByDay.get(dayKey(day)) ?? [];
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn("relative border-r border-border last:border-r-0", isToday(day) && "bg-primary/5")}
                      style={{ height: TOTAL_HEIGHT }}
                    >
                      {/* Huecos soltables por hora; la energía sólo en la vista Día */}
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

                      {timedTasks.map((task) => (
                        <TaskBlock
                          key={task.id}
                          task={task}
                          overrideDuration={resizeInfo?.task.id === task.id ? resizeInfo.currentMinutes : undefined}
                          onOpen={onOpenTask}
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
              "max-w-[11rem] truncate rounded-md border px-2 py-1 text-xs font-semibold opacity-90 shadow-[var(--shadow)]",
              PRIORITY_CHIP[activeTask.effectivePriority ?? "medium"],
            )}
          >
            {activeTask.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
