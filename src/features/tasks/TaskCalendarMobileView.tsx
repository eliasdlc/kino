"use client";

import { useState } from "react";
import { addMonths, format, isSameDay, isSameMonth, isToday, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SectionHead } from "@/features/dashboard/SectionHead";
import type { TaskTransport } from "./tasks.types";
import { TaskRow } from "./TaskRow";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MAX_DOTS = 3;

interface TaskCalendarMobileViewProps {
  month: Date;
  onMonthChange: (updater: (m: Date) => Date) => void;
  days: Date[];
  byDay: Map<string, TaskTransport[]>;
  withoutDate: TaskTransport[];
  onNavigateToAction?: (taskId?: string) => void;
}

/**
 * El mes con el dedo, en Diario: la rejilla de días con un punto neutro por
 * tarea (hasta tres; la prioridad no se dice con color), el día elegido en
 * tinta y hoy en ámbar de texto, y debajo la agenda del día y lo que no tiene
 * fecha como secciones con título y hairline, con la fila de tarea común. Sin
 * arrastre: la fecha se pone desde el detalle. Tocar una fila lleva a la vista
 * de acción del sistema, donde se actúa.
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

  const fila = (task: TaskTransport) => (
    <TaskRow
      key={task.id}
      task={task}
      density="lista"
      completable={false}
      onComplete={() => {}}
      onOpen={onNavigateToAction ? () => onNavigateToAction(task.id) : undefined}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera con navegación */}
      <div className="flex items-center justify-between gap-1">
        <h2 className="font-display text-[1.25rem] leading-tight font-bold tracking-[-0.02em] first-letter:uppercase">
          {format(month, "MMMM yyyy", { locale: es })}
        </h2>
        <div className="flex shrink-0 items-center">
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
          <Button variant="ghost" size="icon" onClick={() => onMonthChange((m) => addMonths(m, -1))} aria-label="Mes anterior">
            <ChevronLeft className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onMonthChange((m) => addMonths(m, 1))} aria-label="Mes siguiente">
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </div>

      <div>
        {/* Encabezado de días de la semana */}
        <div className="grid grid-cols-7 pb-1" aria-hidden>
          {WEEKDAYS.map((d, i) => (
            <div key={i} className="text-center text-[0.7rem] font-semibold text-muted-foreground uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Los días: sin hueco entre ellos, cada uno de 48 px como mínimo. */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const inMonth = isSameMonth(day, month);
            const tasks = byDay.get(format(day, "yyyy-MM-dd")) ?? [];
            const selected = isSameDay(day, selectedDay);
            const today = isToday(day);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => setSelectedDay(day)}
                aria-pressed={selected}
                aria-label={`${format(day, "EEEE d 'de' MMMM", { locale: es })}${tasks.length > 0 ? `, ${tasks.length} tarea${tasks.length === 1 ? "" : "s"}` : ""}`}
                className={cn(
                  "press focus-ring flex min-h-[2.85rem] flex-col items-center justify-center gap-1 rounded-full tabular-nums transition-[color,background-color,transform] duration-(--dur-toque) ease-(--ease-pluma)",
                  selected ? "bg-foreground text-background" : today ? "font-bold text-primary" : "text-foreground hover:bg-sf2",
                  !inMonth && !selected && "text-muted-foreground/60",
                )}
              >
                <span className="text-sm leading-none font-semibold">{format(day, "d")}</span>
                <span className="flex h-1 items-center gap-0.5" aria-hidden>
                  {tasks.slice(0, MAX_DOTS).map((t) => (
                    <span key={t.id} className={cn("size-1 rounded-full", selected ? "bg-background/70" : "bg-muted-foreground/60")} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Agenda del día elegido */}
      <section aria-labelledby="agenda-dia">
        <SectionHead
          id="agenda-dia"
          as="h3"
          title={format(selectedDay, "EEEE d 'de' MMMM", { locale: es }).replace(/^./, (c) => c.toUpperCase())}
          count={selectedTasks.length > 0 ? `${selectedTasks.length} tarea${selectedTasks.length === 1 ? "" : "s"}` : undefined}
        />
        {selectedTasks.length === 0 ? (
          <p className="py-4 pl-(--margen) font-voice text-base text-body italic">Nada para este día.</p>
        ) : (
          <div>{selectedTasks.map(fila)}</div>
        )}
      </section>

      {/* Sin fecha */}
      {withoutDate.length > 0 && (
        <section aria-labelledby="sin-fecha" className="pb-4">
          <SectionHead id="sin-fecha" as="h3" title="Sin fecha" count={`${withoutDate.length} tarea${withoutDate.length === 1 ? "" : "s"}`} />
          <div>{withoutDate.map(fila)}</div>
        </section>
      )}
    </div>
  );
}
