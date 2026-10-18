"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  startOfToday,
} from "date-fns";
import { useTasks, useUpdateTask } from "./tasks.hooks";
import { parseDueDate } from "./tasks.utils";
import type { TaskTransport } from "./tasks.types";
import { TaskCalendarMobileView } from "./TaskCalendarMobileView";
import { useIsMobile } from "@/hooks/use-mobile";

interface TaskCalendarViewProps {
  systemId: string;
  initialData: TaskTransport[];
  /** Click en una tarea → la action view del system (en academic, "Esta Semana").
   *  Pasa el taskId para resaltarla allí; sin id (ej. "+N más") solo navega. */
  onNavigateToAction?: (taskId?: string) => void;
}

function dayId(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** El mes con arrastre, aparte: `@dnd-kit` sólo se descarga en escritorio. */
const TaskCalendarBoard = dynamic(() => import("./TaskCalendarBoard"), {
  ssr: false,
  loading: () => <p className="py-6 text-sm text-muted-foreground">Abriendo el mes</p>,
});

/**
 * CalendarTab: grid de mes (zoom-out). Arrastra una tarea sin fecha a un día
 * para asignarle dueDate; el click en una tarea lleva a la action view, donde
 * realmente se actúa. No es la vista por defecto de Academic.
 */
export function TaskCalendarView({ systemId, initialData, onNavigateToAction }: TaskCalendarViewProps) {
  const { data: allTasks = [] } = useTasks(systemId, initialData);
  const { mutate: updateDueDate } = useUpdateTask(systemId);

  const [month, setMonth] = useState(startOfToday());
  const activeTasks = allTasks.filter((t) => !t.deletedAt && t.status !== "done");
  const withoutDate = activeTasks.filter((t) => !t.dueDate);

  // Tareas con fecha indexadas por día (yyyy-MM-dd).
  const byDay = new Map<string, TaskTransport[]>();
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

  const isMobile = useIsMobile();

  // En mobile los chips de texto no entran en celdas de ~45px: grid con dots
  // + agenda del día seleccionado, sin drag & drop.
  if (isMobile) {
    return (
      <TaskCalendarMobileView
        month={month}
        onMonthChange={setMonth}
        days={days}
        byDay={byDay}
        withoutDate={withoutDate}
        onNavigateToAction={onNavigateToAction}
      />
    );
  }

  return (
    <TaskCalendarBoard
      month={month}
      setMonth={setMonth}
      days={days}
      byDay={byDay}
      withoutDate={withoutDate}
      activeTasks={activeTasks}
      onNavigateToAction={onNavigateToAction}
      updateDueDate={updateDueDate}
    />
  );
}
