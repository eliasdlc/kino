"use client";

import { memo, useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { addDays, addWeeks, eachDayOfInterval, endOfWeek, format, isToday, startOfToday, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { SectionHead } from "@/features/dashboard/SectionHead";
import { cn } from "@/lib/utils";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import type { useUpdateCalendarTask } from "@/features/tasks/tasks.hooks";
import { dayToLocalISO } from "@/features/tasks/tasks.utils";
import type { TaskDragData } from "@/features/tasks/dnd/dnd.types";
import { HOURS, ROW_HEIGHT, TOTAL_HEIGHT, dayKey, minutesToTimeString, resizedMinutes } from "./calendar.layout";
import { AllDayCell, DroppableSlot, PRIORITY_CHIP, TaskBlock, UnscheduledChip } from "./CalendarBlocks";

/**
 * La rejilla de escritorio del calendario, en su propio módulo: es lo único
 * que importa `@dnd-kit`, y `GlobalCalendarView` la carga con `next/dynamic`
 * sin render de servidor. El teléfono no la descarga ni la pinta.
 */

const VISTAS = [
  { value: "week", label: "Semana" },
  { value: "day", label: "Día" },
] as const;

type Vista = (typeof VISTAS)[number]["value"];

/** Lo que las dos vistas leen: el mismo cálculo, para que no puedan discrepar. */
export interface DatosDelCalendario {
  byDayAllDay: Map<string, TaskTransport[]>;
  timedByDay: Map<string, TaskTransport[]>;
  unscheduledTasks: TaskTransport[];
  /** La hora libre que mejor va con la energía de una tarea, o nada sin curva. */
  sugerencia: (task: TaskTransport) => number | null;
}

type UpdateCalendarTask = ReturnType<typeof useUpdateCalendarTask>["mutate"];

export interface CalendarioEscritorioProps {
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
function CalendarioEscritorioBase({
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
        {/* Sin programar: un índice de filas con hairline, como en el teléfono. */}
        <section aria-labelledby="cal-sin-programar-escritorio" className="flex w-56 shrink-0 flex-col overflow-hidden border-r border-border">
          <SectionHead
            id="cal-sin-programar-escritorio"
            title="Sin programar"
            count={unscheduledTasks.length}
            className="mx-3 mt-4 shrink-0"
          />
          <div className="flex-1 overflow-y-auto px-3 pb-2">
            {unscheduledTasks.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Todo lo pendiente ya tiene fecha.</p>
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
                    {/* Hoy se marca con su fecha en tinta subrayada; los demás numerales van en gris. */}
                    <span
                      className={cn(
                        "mt-0.5 block font-display text-lg font-bold tabular-nums",
                        isToday(day)
                          ? "text-foreground underline decoration-foreground decoration-2 underline-offset-[0.25em]"
                          : "text-muted-foreground",
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
                      className="relative border-r border-border last:border-r-0"
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

/**
 * Memorizada: abrir el detalle o la hoja cambia estado del padre, y sin esto
 * cada apertura volvía a pintar los 119 huecos soltables y sus bloques.
 */
export const CalendarioEscritorio = memo(CalendarioEscritorioBase);
export default CalendarioEscritorio;
