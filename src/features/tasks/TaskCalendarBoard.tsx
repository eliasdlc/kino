"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfToday,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DroppableColumn } from "./dnd/DroppableColumn";
import { parseDueDate, dayToLocalISO } from "./tasks.utils";
import { cn } from "@/lib/utils";
import type { TaskTransport, UpdateTaskInput } from "./tasks.types";

export interface TaskCalendarBoardProps {
  month: Date;
  setMonth: React.Dispatch<React.SetStateAction<Date>>;
  days: Date[];
  byDay: Map<string, TaskTransport[]>;
  withoutDate: TaskTransport[];
  activeTasks: TaskTransport[];
  onNavigateToAction?: (taskId?: string) => void;
  updateDueDate: (variables: { taskId: string; data: UpdateTaskInput }) => void;
}

const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const MAX_CHIPS_PER_DAY = 3;

function dayId(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function TaskChip({
  task,
  onClick,
}: {
  task: TaskTransport;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        "truncate rounded-md bg-secondary px-1.5 py-1 text-xs leading-tight",
        "cursor-pointer transition-[background-color] duration-(--dur-toque) ease-(--ease-pluma) hover:bg-sf2",
        isDragging && "opacity-30"
      )}
      title={task.title}
    >
      {task.title}
    </div>
  );
}

/**
 * El mes de un sistema en escritorio, con arrastre de ratón y de teclado: una
 * tarea sin fecha se suelta en un día. Es el único módulo del calendario de
 * sistema que importa `@dnd-kit`, y `TaskCalendarView` lo carga aparte y sólo
 * en escritorio; el teléfono usa la agenda sin arrastre.
 */
export default function TaskCalendarBoard({ month, setMonth, days, byDay, withoutDate, activeTasks, onNavigateToAction, updateDueDate }: TaskCalendarBoardProps) {
  const [draggingTask, setDraggingTask] = useState<TaskTransport | null>(null);

  // Sólo ratón y teclado: con el dedo no se arrastra.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragStart({ active }: DragStartEvent) {
    setDraggingTask(activeTasks.find((t) => t.id === active.id) ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggingTask(null);
    if (!over) return;
    const newDay = over.id as string; // yyyy-MM-dd
    const task = activeTasks.find((t) => t.id === active.id);
    if (!task) return;

    // Sin fecha previa (panel "Sin fecha") → asignar ese día a medianoche local.
    if (!task.dueDate) {
      updateDueDate({ taskId: task.id, data: { dueDate: dayToLocalISO(newDay) } });
      return;
    }

    const oldDueDay = format(parseDueDate(task.dueDate), "yyyy-MM-dd");
    if (oldDueDay === newDay) return;
    const delta = differenceInCalendarDays(parseISO(newDay), parseISO(oldDueDay));

    // Desplazar el/los instante(s) el mismo delta de días: preserva la hora y,
    // si hay rango (inicio + fin), preserva la duración en vez de colapsarla.
    const newDue = addDays(parseDueDate(task.dueDate), delta).toISOString();
    if (task.startDate) {
      const newStart = addDays(parseDueDate(task.startDate), delta).toISOString();
      updateDueDate({ taskId: task.id, data: { startDate: newStart, dueDate: newDue } });
      return;
    }
    updateDueDate({ taskId: task.id, data: { dueDate: newDue } });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4">
        {/* Panel sin fecha: origen de arrastre */}
        <div className="w-44 shrink-0">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            Sin fecha
          </h3>
          <div className="space-y-1.5">
            {withoutDate.length === 0 ? (
              <p className="text-xs text-muted-foreground/50 text-center py-4">
                Todas tienen fecha
              </p>
            ) : (
              withoutDate.map((task) => (
                <TaskChip key={task.id} task={task} onClick={() => onNavigateToAction?.(task.id)} />
              ))
            )}
          </div>
        </div>

        {/* Calendario de mes */}
        <div className="flex-1 min-w-0">
          {/* Cabecera con navegación */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold capitalize">
              {format(month, "MMMM yyyy", { locale: es })}
            </h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setMonth(startOfToday())}>
                Hoy
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Mes anterior"
                onClick={() => setMonth((m) => addMonths(m, -1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Mes siguiente"
                onClick={() => setMonth((m) => addMonths(m, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {/* Encabezado de días de la semana */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground text-center pb-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grid de días */}
          <div className="grid grid-cols-7 gap-1 auto-rows-fr">
            {days.map((day) => {
              const inMonth = isSameMonth(day, month);
              const tasks = byDay.get(dayId(day)) ?? [];
              const visible = tasks.slice(0, MAX_CHIPS_PER_DAY);
              const overflow = tasks.length - visible.length;
              return (
                <DroppableColumn
                  key={day.toISOString()}
                  id={dayId(day)}
                  className={cn(
                    // Una celda es un renglón del mes: hairline arriba, sin caja ni fondo.
                    "flex min-h-[5.2rem] flex-col gap-1 rounded-none border-t border-border p-1.5",
                    !inMonth && "opacity-40"
                  )}
                >
                  <span
                    className={cn(
                      "px-0.5 text-xs tabular-nums",
                      isToday(day) ? "font-bold text-primary" : "font-medium text-muted-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="space-y-1 overflow-hidden">
                    {visible.map((task) => (
                      <TaskChip key={task.id} task={task} onClick={() => onNavigateToAction?.(task.id)} />
                    ))}
                    {overflow > 0 && (
                      <button
                        type="button"
                        onClick={() => onNavigateToAction?.()}
                        className="text-[11px] text-muted-foreground hover:text-foreground px-0.5"
                      >
                        +{overflow} más
                      </button>
                    )}
                  </div>
                </DroppableColumn>
              );
            })}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
        {draggingTask && (
          <div className="max-w-44 truncate rounded-md border border-input bg-background px-2 py-1 text-xs font-medium">
            {draggingTask.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
