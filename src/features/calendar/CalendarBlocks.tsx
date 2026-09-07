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
 * Piezas de presentación de la rejilla del calendario (KIN-146 · FE-05).
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

export function AllDayCell({ day, tasks }: { day: Date; tasks: TaskTransport[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `allday:${dayKey(day)}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-r last:border-r-0 p-1 min-h-[32px] space-y-0.5 transition-colors",
        isOver && "bg-primary/10",
        isToday(day) && "bg-primary/5",
      )}
    >
      {tasks.map((t) => (
        <div
          key={t.id}
          className={cn(
            "px-1.5 py-0.5 rounded border text-[11px] truncate",
            PRIORITY_CHIP[t.priority ?? "medium"],
          )}
        >
          {t.title}
        </div>
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
        "absolute w-full border-t border-border/40 transition-colors",
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
  onResizeStart: (e: React.PointerEvent, task: TaskTransport, startMinutes: number) => void;
}

// Wrapper sin hooks: el early-return (tarea sin fecha ubicable) vive aquí, para
// que TaskBlockInner nunca llame useDraggable condicionalmente (rules-of-hooks).
export function TaskBlock({ task, overrideDuration, onResizeStart }: TaskBlockProps) {
  const placementDate = getPlacementDate(task);
  const d = placementDate ? parseDueDate(placementDate) : null;
  if (!d) return null;
  return (
    <TaskBlockInner
      task={task}
      d={d}
      overrideDuration={overrideDuration}
      onResizeStart={onResizeStart}
    />
  );
}

function TaskBlockInner({
  task,
  d,
  overrideDuration,
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
      className={cn(
        "absolute left-0.5 right-0.5 rounded border px-1.5 pt-0.5 pb-2 text-[11px] leading-tight select-none cursor-grab active:cursor-grabbing overflow-hidden",
        PRIORITY_CHIP[task.priority ?? "medium"],
        isDragging && "opacity-30",
      )}
      style={{ top, height }}
      title={task.title}
    >
      <span className="font-medium">{format(d, "HH:mm")} </span>
      <span className="truncate">{task.title}</span>
      {/* Resize handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2.5 cursor-row-resize flex items-center justify-center opacity-40 hover:opacity-80"
        onPointerDown={(e) => {
          e.stopPropagation(); // don't trigger drag
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
}: {
  task: TaskTransport;
  suggestedHour: number | null;
  onAcceptSuggestion: (task: TaskTransport, hour: number) => void;
}) {
  const dragData: TaskDragData = { task, sourceType: "unscheduled", sourceId: "unscheduled" };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `unscheduled:${task.id}`,
    data: dragData,
  });
  return (
    <div
      className={cn(
        "rounded border text-xs select-none",
        PRIORITY_CHIP[task.priority ?? "medium"],
        isDragging && "opacity-30",
      )}
    >
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className="px-2 py-1 truncate cursor-grab active:cursor-grabbing"
        title={task.title}
      >
        {task.title}
      </div>
      {suggestedHour !== null && (
        <button
          type="button"
          className="w-full text-left px-2 pb-1 text-[10px] text-primary/80 hover:text-primary flex items-center gap-1 leading-tight"
          onClick={() => onAcceptSuggestion(task, suggestedHour)}
        >
          <span>Sugerido a las {format(new Date(2000, 0, 1, suggestedHour), "HH:mm")}</span>
          <span className="text-primary/50">→</span>
        </button>
      )}
    </div>
  );
}
