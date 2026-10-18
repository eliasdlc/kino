"use client";

import { useDroppable, useDraggable } from "@dnd-kit/core";
import { format, isToday } from "date-fns";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import { parseDueDate } from "@/features/tasks/tasks.utils";
import type { TaskDragData } from "@/features/tasks/dnd/dnd.types";
import {
  ROW_HEIGHT,
  blockGeometry,
  dayKey,
  energyBgClass,
  getPlacementDate,
  parseEstimatedMinutes,
  slotTop,
} from "./calendar.layout";

/**
 * Piezas de presentación de la rejilla del calendario (KIN-146, FE-05).
 * Extraídas de `GlobalCalendarView` tal cual: sólo pintan y arrastran, la
 * geometría la resuelve `calendar.layout.ts`.
 */

/** El bloque es superficie con hairline; la prioridad es peso, no color. */
export const PRIORITY_CHIP: Record<string, string> = {
  critical: "bg-card border-border font-semibold",
  high: "bg-card border-border",
  medium: "bg-card border-border",
  low: "bg-card border-border text-muted-foreground",
};

export function AllDayCell({
  day,
  tasks,
  onOpenTask,
}: {
  day: Date;
  tasks: TaskTransport[];
  onOpenTask: (task: TaskTransport) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `allday:${dayKey(day)}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[2rem] space-y-0.5 border-r border-border p-1 transition-colors duration-(--dur-toque) ease-(--ease-pluma) last:border-r-0",
        isOver && "bg-primary/10",
        isToday(day) && "bg-primary/5",
      )}
    >
      {tasks.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onOpenTask(t)}
          className={cn(
            "focus-ring block w-full truncate rounded-md border px-1.5 py-0.5 text-left text-xs pointer-coarse:min-h-[2.85rem]",
            PRIORITY_CHIP[t.effectivePriority ?? "medium"],
          )}
        >
          {t.title}
        </button>
      ))}
    </div>
  );
}

export function DroppableSlot({
  id,
  hour,
  energyCapacity,
}: {
  id: string;
  hour: number;
  energyCapacity?: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute w-full border-t border-border/40 transition-colors duration-(--dur-toque) ease-(--ease-pluma)",
        isOver && "bg-primary/15",
        hour % 2 === 0 ? "border-border/40" : "border-border/20",
        energyCapacity !== undefined && !isOver && energyBgClass(energyCapacity),
      )}
      style={{ top: slotTop(hour), height: ROW_HEIGHT }}
    />
  );
}

interface TaskBlockProps {
  task: TaskTransport;
  overrideDuration?: number;
  /** Abre el detalle. Un clic sin mover no arrastra (el sensor pide 6 px). */
  onOpen: (task: TaskTransport) => void;
  onResizeStart: (e: React.PointerEvent, task: TaskTransport, startMinutes: number) => void;
}

// Wrapper sin hooks: el early-return (tarea sin fecha ubicable) vive aquí, para
// que TaskBlockInner nunca llame useDraggable condicionalmente (rules-of-hooks).
export function TaskBlock({ task, overrideDuration, onOpen, onResizeStart }: TaskBlockProps) {
  const placementDate = getPlacementDate(task);
  const d = placementDate ? parseDueDate(placementDate) : null;
  if (!d) return null;
  return (
    <TaskBlockInner
      task={task}
      d={d}
      overrideDuration={overrideDuration}
      onOpen={onOpen}
      onResizeStart={onResizeStart}
    />
  );
}

function TaskBlockInner({
  task,
  d,
  overrideDuration,
  onOpen,
  onResizeStart,
}: TaskBlockProps & { d: Date }) {
  const estimatedMinutes = overrideDuration ?? parseEstimatedMinutes(task.estimatedTime);
  const { top, height } = blockGeometry(d, estimatedMinutes);

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
      role="button"
      aria-label={`${format(d, "HH:mm")}, ${task.title}`}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(task);
      }}
      className={cn(
        "focus-ring absolute right-0.5 left-0.5 cursor-grab overflow-hidden rounded-md border px-1.5 pt-0.5 pb-2 text-xs leading-tight select-none active:cursor-grabbing",
        PRIORITY_CHIP[task.effectivePriority ?? "medium"],
        isDragging && "opacity-30",
      )}
      style={{ top, height }}
      title={task.title}
    >
      <span className="font-semibold tabular-nums">{format(d, "HH:mm")} </span>
      <span className="truncate">{task.title}</span>
      {/* El tirador de redimensionar: sólo con puntero fino, el dedo cambia la
          duración en el detalle. */}
      <div
        className="absolute right-0 bottom-0 left-0 flex h-2.5 cursor-row-resize items-center justify-center opacity-40 transition-opacity duration-(--dur-toque) hover:opacity-80 pointer-coarse:hidden"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          e.stopPropagation(); // que no arranque el arrastre
          onResizeStart(e, task, estimatedMinutes);
        }}
      >
        <GripVertical className="size-2.5 rotate-90" />
      </div>
    </div>
  );
}

export function UnscheduledChip({
  task,
  suggestedHour,
  onAcceptSuggestion,
  onProgramar,
}: {
  task: TaskTransport;
  suggestedHour: number | null;
  onAcceptSuggestion: (task: TaskTransport, hour: number) => void;
  /** La hoja con nombre: lo que el dedo hace en vez de arrastrar. */
  onProgramar: (task: TaskTransport) => void;
}) {
  const dragData: TaskDragData = { task, sourceType: "unscheduled", sourceId: "unscheduled" };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `unscheduled:${task.id}`,
    data: dragData,
  });
  return (
    <div
      className={cn(
        "rounded-md border text-sm select-none",
        PRIORITY_CHIP[task.effectivePriority ?? "medium"],
        isDragging && "opacity-30",
      )}
    >
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab truncate px-2 pt-1.5 pb-1 active:cursor-grabbing"
        title={task.title}
      >
        {task.title}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 px-1 pb-1">
        {suggestedHour !== null && (
          <button
            type="button"
            className="focus-ring rounded-full px-1 text-xs font-semibold text-primary transition-colors duration-(--dur-toque) hover:underline pointer-coarse:min-h-[2.85rem]"
            onClick={() => onAcceptSuggestion(task, suggestedHour)}
          >
            A las {format(new Date(2000, 0, 1, suggestedHour), "HH:mm")}
          </button>
        )}
        <button
          type="button"
          className="focus-ring rounded-full px-1 text-xs font-semibold text-muted-foreground transition-colors duration-(--dur-toque) hover:text-foreground pointer-coarse:min-h-[2.85rem]"
          aria-label={`Programar ${task.title}`}
          onClick={() => onProgramar(task)}
        >
          Programar
        </button>
      </div>
    </div>
  );
}
