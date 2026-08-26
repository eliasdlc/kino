"use client";

import { useState } from "react";
import { addMonths, format, isSameDay, isSameMonth, isToday, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TaskTransport } from "./tasks.types";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MAX_DOTS = 3;

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-neutral-400",
};

interface TaskCalendarMobileViewProps {
  month: Date;
  onMonthChange: (updater: (m: Date) => Date) => void;
  days: Date[];
  byDay: Map<string, TaskTransport[]>;
  withoutDate: TaskTransport[];
  onNavigateToAction?: (taskId?: string) => void;
}

function TaskRow({ task, onClick }: { task: TaskTransport; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg bg-background border border-border text-left text-sm hover:border-primary/50 transition-colors"
    >
      <span className={cn("size-2 rounded-full shrink-0", PRIORITY_DOT[task.priority ?? "medium"])} />
      <span className="truncate">{task.title}</span>
    </button>
  );
}

/**
 * Variante mobile del calendario: grid compacto con dots por día (patrón
 * agenda) + lista de tareas del día seleccionado debajo. Sin drag & drop —
 * en touch se asigna fecha desde el detalle de la tarea.
 */
export function TaskCalendarMobileView({
  month,
  onMonthChange,
  days,
  byDay,
  withoutDate,
  onNavigateToAction,
}: TaskCalendarMobileViewProps) {
  const [selectedDay, setSelectedDay] = useState<Date>(startOfToday());

  const selectedTasks = byDay.get(format(selectedDay, "yyyy-MM-dd")) ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* Cabecera con navegación */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold capitalize">
          {format(month, "MMMM yyyy", { locale: es })}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onMonthChange(() => startOfToday());
              setSelectedDay(startOfToday());
            }}
          >
            Hoy
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => onMonthChange((m) => addMonths(m, -1))} aria-label="Mes anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => onMonthChange((m) => addMonths(m, 1))} aria-label="Mes siguiente">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Encabezado de días de la semana */}
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-[11px] font-medium uppercase text-muted-foreground text-center">
            {d}
          </div>
        ))}
      </div>

      {/* Grid de días con dots */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const tasks = byDay.get(format(day, "yyyy-MM-dd")) ?? [];
          const selected = isSameDay(day, selectedDay);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg py-1.5 transition-colors",
                !inMonth && "opacity-40",
                selected
                  ? "bg-primary text-primary-foreground"
                  : isToday(day)
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent"
              )}
            >
              <span className="text-sm font-medium leading-none">{format(day, "d")}</span>
              <span className="flex items-center gap-0.5 h-1.5">
                {tasks.slice(0, MAX_DOTS).map((t) => (
                  <span
                    key={t.id}
                    className={cn(
                      "size-1.5 rounded-full",
                      selected ? "bg-primary-foreground/80" : PRIORITY_DOT[t.priority ?? "medium"]
                    )}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {/* Agenda del día seleccionado */}
      <div className="border-t pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 capitalize">
          {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
        </h3>
        {selectedTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground/60 py-3 text-center">Nada para este día.</p>
        ) : (
          <div className="space-y-1.5">
            {selectedTasks.map((task) => (
              <TaskRow key={task.id} task={task} onClick={() => onNavigateToAction?.(task.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Sin fecha */}
      {withoutDate.length > 0 && (
        <div className="border-t pt-3 pb-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Sin fecha
          </h3>
          <div className="space-y-1.5">
            {withoutDate.map((task) => (
              <TaskRow key={task.id} task={task} onClick={() => onNavigateToAction?.(task.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
