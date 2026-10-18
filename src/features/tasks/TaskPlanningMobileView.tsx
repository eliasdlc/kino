"use client";

import { useState } from "react";
import { format, isSameDay, isToday, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MarginRow } from "@/components/ui/margin-row";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import { TaskRow } from "./TaskRow";
import { MultiDayTaskBar } from "./MultiDayTaskBar";
import type { TaskTransport } from "./tasks.types";
import { parseDueDate, parseTaskDay } from "./tasks.utils";

interface TaskPlanningMobileViewProps {
  weekDates: Date[];
  weekOffset: number;
  monthHeading: string;
  weekNumber: number;
  singleDayTasks: TaskTransport[];
  multiDayTasks: TaskTransport[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onResetWeek: () => void;
  onToggle: (taskId: string) => void;
  onDelete: (task: TaskTransport) => void;
  onEdit?: (task: TaskTransport) => void;
  onMoveToDay: (taskId: string, dayISO: string) => void;
}

/**
 * Planificación en el teléfono: un día a la vez, con los siete días de la
 * semana arriba (el elegido en tinta) y las tareas del día como filas de
 * tarea. Sin arrastre: mover de día es una operación con nombre, "Mover a otro
 * día", que abre una hoja con los siete días en renglones de 48 px.
 */
export function TaskPlanningMobileView({
  weekDates,
  weekOffset,
  monthHeading,
  weekNumber,
  singleDayTasks,
  multiDayTasks,
  onPrevWeek,
  onNextWeek,
  onResetWeek,
  onToggle,
  onDelete,
  onEdit,
  onMoveToDay,
}: TaskPlanningMobileViewProps) {
  // Índice del día seleccionado (0 = lunes). Se mantiene al cambiar de semana.
  const [selectedIndex, setSelectedIndex] = useState(() => (new Date().getDay() + 6) % 7);
  const [moviendo, setMoviendo] = useState<TaskTransport | null>(null);

  const selectedDate = weekDates[selectedIndex]!;
  const selectedISO = format(selectedDate, "yyyy-MM-dd");

  const dayTasks = singleDayTasks.filter((t) => {
    const anchor = t.startDate ?? t.dueDate;
    return anchor != null && isSameDay(parseTaskDay(anchor), selectedDate);
  });
  const dayMultiTasks = multiDayTasks.filter((t) =>
    isWithinInterval(selectedDate, {
      start: startOfDay(parseDueDate(t.startDate!)),
      end: endOfDay(parseDueDate(t.dueDate!)),
    })
  );

  function hasTasks(date: Date) {
    return singleDayTasks.some((t) => {
      const anchor = t.startDate ?? t.dueDate;
      return anchor != null && isSameDay(parseTaskDay(anchor), date);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Navegación de semana */}
      <div className="flex items-center justify-between gap-1">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={onPrevWeek} aria-label="Semana anterior">
          <ChevronLeft className="size-5" />
        </Button>
        <h2 className="truncate font-display text-[1.25rem] leading-tight font-bold tracking-[-0.02em] first-letter:uppercase">
          {monthHeading}
          <span className="ml-1.5 font-sans text-sm font-normal text-muted-foreground tabular-nums">semana {weekNumber}</span>
        </h2>
        <div className="flex shrink-0 items-center">
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" onClick={onResetWeek}>
              Hoy
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onNextWeek} aria-label="Semana siguiente">
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </div>

      {/* Los días de la semana: el elegido en tinta, hoy en ámbar. */}
      <div className="grid grid-cols-7 gap-1" role="radiogroup" aria-label="Día">
        {weekDates.map((date, i) => {
          const selected = i === selectedIndex;
          const today = isToday(date);
          return (
            <button
              key={date.toISOString()}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={format(date, "EEEE d", { locale: es })}
              onClick={() => setSelectedIndex(i)}
              className={cn(
                "press focus-ring flex min-h-[3.4rem] flex-col items-center justify-center gap-0.5 rounded-full transition-[color,background-color,transform] duration-(--dur-toque) ease-(--ease-pluma)",
                selected ? "bg-foreground text-background" : today ? "text-primary" : "text-muted-foreground hover:bg-sf2",
              )}
            >
              <span className="text-[0.7rem] font-semibold uppercase">{format(date, "EEEEE", { locale: es })}</span>
              <span className="text-sm leading-none font-bold tabular-nums">{format(date, "d")}</span>
              <span
                className={cn("size-1 rounded-full", hasTasks(date) ? (selected ? "bg-background/70" : "bg-muted-foreground/60") : "bg-transparent")}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      {/* Tareas multi-día que pasan por este día */}
      {dayMultiTasks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {dayMultiTasks.map((task) => (
            <MultiDayTaskBar key={task.id} task={task} onEdit={onEdit} startCol={1} span={1} />
          ))}
        </div>
      )}

      {dayTasks.length === 0 && dayMultiTasks.length === 0 ? (
        <EmptyState
          className="pl-(--margen)"
          title="Nada para este día"
          description="Un día sin plan también es un plan."
        />
      ) : (
        <div className="pb-4">
          {dayTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              density="lista"
              onComplete={() => onToggle(task.id)}
              onOpen={onEdit ? () => onEdit(task) : undefined}
              actions={[
                { label: "Mover a otro día", icon: CalendarDays, onSelect: () => setMoviendo(task) },
                { label: "Mover a la papelera", icon: Trash2, destructive: true, onSelect: () => onDelete(task) },
              ]}
            />
          ))}
        </div>
      )}

      <ResponsiveDialog open={moviendo !== null} onOpenChange={(open) => !open && setMoviendo(null)}>
        <ResponsiveDialogContent className="sm:max-w-sm">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Mover a otro día</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="line-clamp-2">{moviendo?.title}</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div>
            {weekDates.map((date) => {
              const dayISO = format(date, "yyyy-MM-dd");
              const actual = dayISO === selectedISO;
              return (
                <MarginRow
                  key={dayISO}
                  margin={<span className="mt-[0.5rem] text-sm font-semibold tabular-nums">{format(date, "d")}</span>}
                  trailing={isToday(date) ? "hoy" : actual ? "ahora" : undefined}
                  onClick={() => {
                    if (!moviendo || actual) return;
                    onMoveToDay(moviendo.id, dayISO);
                    setMoviendo(null);
                  }}
                  aria-disabled={actual || undefined}
                  className={cn("min-h-[3.2rem] text-base font-semibold text-foreground", actual && "opacity-50")}
                >
                  <span className="capitalize">{format(date, "EEEE", { locale: es })}</span>
                </MarginRow>
              );
            })}
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
