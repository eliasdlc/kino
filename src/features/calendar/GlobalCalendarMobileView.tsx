"use client";

import { useState } from "react";
import { addDays, format, isBefore, isToday, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarPlus, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import { parseDueDate } from "@/features/tasks/tasks.utils";

const START_HOUR = 6;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

interface GlobalCalendarMobileViewProps {
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
  byDayAllDay: Map<string, TaskTransport[]>;
  byDayHour: Map<string, TaskTransport[]>;
  /** Las que no tienen fecha: en el teléfono también existen. */
  unscheduledTasks: TaskTransport[];
  /** Ponerle a una sin fecha el día que se está mirando. */
  onScheduleOnDay: (task: TaskTransport) => void;
}

function dayKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

/** Un bloque del día: superficie con hairline; vencida lleva la palabra y el coral. */
function DayBlock({ task, time }: { task: TaskTransport; time?: string | null }) {
  const overdue = task.dueDate ? isBefore(parseDueDate(task.dueDate), startOfToday()) && task.status !== "done" : false;
  return (
    <div
      className={cn(
        "truncate rounded-md border px-2 py-1 text-xs",
        overdue ? "border-task-overdue/30 bg-task-overdue/10" : "border-border bg-card",
        task.priority === "critical" && "font-semibold",
      )}
    >
      {overdue && <span className="font-semibold text-task-overdue">vencida · </span>}
      {time && <span className="font-medium tabular-nums">{time} </span>}
      {task.title}
    </div>
  );
}

export function GlobalCalendarMobileView({
  selectedDay,
  onSelectDay,
  byDayAllDay,
  byDayHour,
  unscheduledTasks,
  onScheduleOnDay,
}: GlobalCalendarMobileViewProps) {
  const allDayTasks = byDayAllDay.get(dayKey(selectedDay)) ?? [];
  const [showUnscheduled, setShowUnscheduled] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <Button variant="ghost" size="icon-sm" aria-label="Día anterior" onClick={() => onSelectDay(addDays(selectedDay, -1))}>
          <ChevronLeft className="size-5" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold capitalize">{format(selectedDay, "EEEE", { locale: es })}</p>
          <p className={cn("text-xs", isToday(selectedDay) ? "font-semibold text-primary" : "text-muted-foreground")}>
            {format(selectedDay, "d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Día siguiente" onClick={() => onSelectDay(addDays(selectedDay, 1))}>
          <ChevronRight className="size-5" />
        </Button>
      </div>

      {/* Sin programar: en laptop es una columna; aquí, una sección plegable con la misma acción */}
      <div className="shrink-0 border-b border-border">
        <button
          type="button"
          onClick={() => setShowUnscheduled((v) => !v)}
          aria-expanded={showUnscheduled}
          className="flex w-full items-center gap-2 px-3 py-2 text-left"
        >
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", !showUnscheduled && "-rotate-90")} />
          <span className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">Sin programar</span>
          <span className="text-xs text-muted-foreground tabular-nums">{unscheduledTasks.length}</span>
        </button>
        {showUnscheduled && (
          <div className="max-h-56 space-y-1 overflow-y-auto px-3 pb-2">
            {unscheduledTasks.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">Nada pendiente sin fecha.</p>
            ) : (
              unscheduledTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1">
                  <span className={cn("min-w-0 flex-1 truncate text-xs", task.priority === "critical" && "font-semibold")}>{task.title}</span>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Poner ${task.title} este día`}
                    onClick={() => onScheduleOnDay(task)}
                  >
                    <CalendarPlus className="size-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {allDayTasks.length > 0 && (
        <div className="shrink-0 space-y-1 border-b border-border px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">Todo el día</p>
          {allDayTasks.map((task) => (
            <DayBlock key={task.id} task={task} />
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {HOURS.map((hour) => {
          const tasks = byDayHour.get(`${dayKey(selectedDay)}:${hour}`) ?? [];
          return (
            <div key={hour} className="flex min-h-12 gap-2 border-b border-border px-3 py-1.5">
              <div className="w-10 shrink-0 pt-0.5">
                <span className="text-[0.65rem] text-muted-foreground tabular-nums">
                  {format(new Date(2000, 0, 1, hour), "HH:mm")}
                </span>
              </div>
              <div className="flex-1 space-y-0.5">
                {tasks.map((task) => (
                  <DayBlock
                    key={task.id}
                    task={task}
                    time={task.dueDate ? format(parseDueDate(task.dueDate), "HH:mm") : null}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
