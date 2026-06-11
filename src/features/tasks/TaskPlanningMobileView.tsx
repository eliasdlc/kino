"use client";

import { useState } from "react";
import { format, isSameDay, isToday, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, MoreVertical, CalendarDays, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PlanningTaskCard } from "./PlanningTaskCard";
import { MultiDayTaskBar } from "./MultiDayTaskBar";
import type { Task } from "./tasks.types";
import { parseDueDate } from "./tasks.utils";

interface TaskPlanningMobileViewProps {
  weekDates: Date[];
  weekOffset: number;
  monthHeading: string;
  weekNumber: number;
  singleDayTasks: Task[];
  multiDayTasks: Task[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onResetWeek: () => void;
  onToggle: (taskId: string) => void;
  onDelete: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onMoveToDay: (taskId: string, dayISO: string) => void;
}

/**
 * Variante mobile de Planificación: un día a la vez con pills de la semana
 * arriba. Sin drag & drop — mover de día se hace desde el menú "⋮" de cada
 * tarea, que en touch es mucho más fiable que arrastrar.
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

  const selectedDate = weekDates[selectedIndex]!;
  const selectedISO = format(selectedDate, "yyyy-MM-dd");

  const dayTasks = singleDayTasks.filter(
    (t) => t.startDate && isSameDay(parseDueDate(t.startDate), selectedDate)
  );
  const dayMultiTasks = multiDayTasks.filter((t) =>
    isWithinInterval(selectedDate, {
      start: startOfDay(parseDueDate(t.startDate!)),
      end: endOfDay(parseDueDate(t.dueDate!)),
    })
  );

  function hasTasks(date: Date) {
    return singleDayTasks.some(
      (t) => t.startDate && isSameDay(parseDueDate(t.startDate), date)
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Navegación de semana */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={onPrevWeek} aria-label="Semana anterior">
          <ChevronLeft className="size-5" />
        </Button>
        <h2 className="text-base font-bold capitalize truncate">
          {monthHeading}
          <span className="text-sm font-normal text-muted-foreground ml-1.5">— S{weekNumber}</span>
        </h2>
        <div className="flex items-center gap-1 shrink-0">
          {weekOffset !== 0 && (
            <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={onResetWeek}>
              Hoy
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-8" onClick={onNextWeek} aria-label="Semana siguiente">
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </div>

      {/* Pills de días */}
      <div className="grid grid-cols-7 gap-1">
        {weekDates.map((date, i) => {
          const selected = i === selectedIndex;
          const today = isToday(date);
          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => setSelectedIndex(i)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors",
                selected
                  ? "bg-primary text-primary-foreground"
                  : today
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent"
              )}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide">
                {format(date, "EEEEE", { locale: es })}
              </span>
              <span className="text-sm font-bold leading-none">{format(date, "d")}</span>
              <span
                className={cn(
                  "size-1 rounded-full",
                  hasTasks(date)
                    ? selected
                      ? "bg-primary-foreground/70"
                      : "bg-primary/60"
                    : "bg-transparent"
                )}
              />
            </button>
          );
        })}
      </div>

      {/* Encabezado del día seleccionado */}
      <div className={cn("flex items-baseline gap-1.5 border-b pb-1.5", isToday(selectedDate) ? "border-primary/30" : "border-border")}>
        <span className={cn("text-[11px] font-semibold uppercase tracking-wider", isToday(selectedDate) ? "text-primary" : "text-muted-foreground")}>
          {format(selectedDate, "EEEE", { locale: es })}
        </span>
        <span className={cn("text-xl font-bold leading-none", isToday(selectedDate) ? "text-primary" : "text-foreground")}>
          {format(selectedDate, "d")}
        </span>
      </div>

      {/* Tareas multi-día que pasan por este día */}
      {dayMultiTasks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {dayMultiTasks.map((task) => (
            <MultiDayTaskBar key={task.id} task={task} onEdit={onEdit} startCol={1} span={1} />
          ))}
        </div>
      )}

      {/* Tareas del día */}
      {dayTasks.length === 0 && dayMultiTasks.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Nada planificado para este día.
        </div>
      ) : (
        <div className="flex flex-col gap-2 pb-4">
          {dayTasks.map((task) => (
            <div key={task.id} className="flex items-stretch gap-1">
              <div className="flex-1 min-w-0">
                <PlanningTaskCard
                  task={task}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onEdit={onEdit}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center px-1.5 rounded-lg text-muted-foreground hover:bg-accent"
                    aria-label="Acciones de la tarea"
                  >
                    <MoreVertical className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" />
                    Mover a…
                  </DropdownMenuLabel>
                  {weekDates.map((date) => {
                    const dayISO = format(date, "yyyy-MM-dd");
                    return (
                      <DropdownMenuItem
                        key={dayISO}
                        disabled={dayISO === selectedISO}
                        onClick={() => onMoveToDay(task.id, dayISO)}
                        className="capitalize"
                      >
                        {format(date, "EEEE d", { locale: es })}
                        {isToday(date) && <span className="ml-auto text-xs text-muted-foreground">hoy</span>}
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(task)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-3.5 mr-1.5" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
