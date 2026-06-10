"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
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
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
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
import { useTasks, useUpdateTask } from "./tasks.hooks";
import { DroppableColumn } from "./dnd/DroppableColumn";
import { parseDueDate, dayToLocalISO } from "./tasks.utils";
import { cn } from "@/lib/utils";
import type { Task } from "./tasks.types";

interface TaskCalendarViewProps {
  systemId: string;
  initialData: Task[];
  /** Click en una tarea → la action view del system (en academic, "Esta Semana").
   *  Pasa el taskId para resaltarla allí; sin id (ej. "+N más") solo navega. */
  onNavigateToAction?: (taskId?: string) => void;
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
  task: Task;
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
        "px-1.5 py-1 rounded-md bg-background border border-border text-xs leading-tight",
        "cursor-pointer hover:border-primary/50 transition-colors truncate",
        isDragging && "opacity-30"
      )}
      title={task.title}
    >
      {task.title}
    </div>
  );
}

/**
 * CalendarTab — grid de mes (zoom-out). Arrastra una tarea sin fecha a un día
 * para asignarle dueDate; el click en una tarea lleva a la action view, donde
 * realmente se actúa. No es la vista por defecto de Academic.
 */
export function TaskCalendarView({ systemId, initialData, onNavigateToAction }: TaskCalendarViewProps) {
  const { data: allTasks = [] } = useTasks(systemId, initialData);
  const { mutate: updateDueDate } = useUpdateTask(systemId);

  const [month, setMonth] = useState(startOfToday());
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const activeTasks = allTasks.filter((t) => !t.deletedAt && t.status !== "done");
  const withoutDate = activeTasks.filter((t) => !t.dueDate);

  // Tareas con fecha indexadas por día (yyyy-MM-dd).
  const byDay = new Map<string, Task[]>();
  for (const t of activeTasks) {
    if (!t.dueDate) continue;
    const key = dayId(parseDueDate(t.dueDate));
    const bucket = byDay.get(key);
    if (bucket) bucket.push(t);
    else byDay.set(key, [t]);
  }

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

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
        {/* Panel sin fecha — origen de arrastre */}
        <div className="w-44 shrink-0">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            Sin fecha
          </h3>
          <div className="space-y-1.5">
            {withoutDate.length === 0 ? (
              <p className="text-xs text-muted-foreground/50 text-center py-4">
                Todas tienen fecha ✓
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
                onClick={() => setMonth((m) => addMonths(m, -1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
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
                    "min-h-[88px] rounded-lg border p-1.5 flex flex-col gap-1",
                    inMonth ? "bg-muted/20" : "bg-transparent opacity-40",
                    isToday(day) && "ring-1 ring-primary/40"
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-medium px-0.5",
                      isToday(day) ? "text-primary" : "text-muted-foreground"
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

      <DragOverlay>
        {draggingTask && (
          <div className="opacity-90 rotate-1 shadow-xl max-w-44 px-2 py-1 rounded-md bg-background border border-border text-xs font-medium truncate">
            {draggingTask.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
