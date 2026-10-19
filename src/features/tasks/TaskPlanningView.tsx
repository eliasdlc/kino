"use client";

import dynamic from "next/dynamic";
import { usePlanningWeek } from "@/shared/hooks/use-url-view";
import { useMemo } from "react";
import {
  addDays,
  addWeeks,
  format,
  getISOWeek,
  isSameDay,
  startOfWeek,
  isBefore,
  isAfter,
} from "date-fns";
import { es } from "date-fns/locale";
import { useTasks, useFolderTasks, useToggleTask, useDeleteTaskWithUndo, useUpdateTask } from "./tasks.hooks";
import type { TaskTransport } from "./tasks.types";
import { parseDueDate, parseTaskDay, dayToLocalISO } from "./tasks.utils";
import { useTaskKeyboardNavigation } from "./useTaskKeyboardNavigation";
import { TaskPlanningMobileView } from "./TaskPlanningMobileView";
import { usePunteroGrueso } from "./use-puntero-grueso";
import { useTacharEnSitio } from "./useTachar";

/**
 * La semana con arrastre, aparte: `@dnd-kit` sólo se descarga en escritorio y
 * al abrir Planificación. Mientras llega, el texto de estado ocupa su sitio.
 */
const TaskPlanningBoard = dynamic(() => import("./TaskPlanningBoard"), {
  ssr: false,
  loading: () => <p className="py-6 text-sm text-muted-foreground">Abriendo la semana</p>,
});

/** ¿startDate y dueDate caen el mismo día calendario? (ambos timestamptz). */
function sameDueDay(startDate: string, dueDate: string): boolean {
  return format(parseDueDate(dueDate), "yyyy-MM-dd") === format(parseDueDate(startDate), "yyyy-MM-dd");
}

interface TaskPlanningViewProps {
  systemId: string;
  initialData: TaskTransport[];
  folderId?: string;
  folderInitialData?: TaskTransport[];
  onEdit?: (task: TaskTransport) => void;
  keyboardDisabled?: boolean;
}

/**
 * Planificación: la semana, con lo que se trabaja cada día. Completar tacha la
 * fila en su día con Deshacer de cuatro segundos; mover a la papelera no
 * pregunta, el aviso trae Deshacer.
 */
export function TaskPlanningView({ systemId, initialData, folderId, folderInitialData, onEdit, keyboardDisabled }: TaskPlanningViewProps) {
  // Use folder-scoped or system-scoped tasks depending on context
  const systemQuery = useTasks(systemId, initialData);
  const folderQuery = useFolderTasks(systemId, folderId ?? "", folderInitialData);
  const { data: tasks = [] } = folderId ? folderQuery : systemQuery;

  const { mutate: toggleTask } = useToggleTask(systemId, folderId);
  const { mutate: deleteTask } = useDeleteTaskWithUndo(systemId, folderId);
  const { mutate: updateTask } = useUpdateTask(systemId);
  const { struck, handleToggle, estadoDe } = useTacharEnSitio((id) => toggleTask(id));

  // Week navigation: 0 = current week, 1 = next, -1 = previous
  const [weekOffset, setWeekOffset] = usePlanningWeek();

  const weekDates = useMemo(() => {
    const baseDate = addWeeks(new Date(), weekOffset);
    const monday = startOfWeek(baseDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [weekOffset]);

  const weekNumber = useMemo(() => getISOWeek(weekDates[0]!), [weekDates]);

  const monthHeading = useMemo(() => {
    const start = weekDates[0]!;
    const end = weekDates[weekDates.length - 1]!;
    const sameMonth =
      start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (sameMonth) {
      return format(start, "LLLL yyyy", { locale: es });
    }
    return `${format(start, "LLLL", { locale: es })} a ${format(end, "LLLL yyyy", { locale: es })}`;
  }, [weekDates]);

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Una tachada en esta visita se queda en su día hasta la siguiente.
      if (estadoDe(task) === "done") return false;

      // Multi-day task: has startDate and dueDate, and they are different
      if (task.startDate && task.dueDate && !sameDueDay(task.startDate, task.dueDate)) {
        const start = parseDueDate(task.startDate);
        const due = parseDueDate(task.dueDate);
        const weekStart = weekDates[0]!;
        const weekEnd = weekDates[6]!;
        // Intersects visible week if it starts before/on weekEnd AND ends after/on weekStart
        return !isAfter(start, weekEnd) && !isBefore(due, weekStart);
      }

      // Single-day: se ancla en startDate (cuándo se trabaja) o, si solo hay
      // fecha límite, en dueDate: así un deadline sin programar igual aparece.
      const anchor = task.startDate ?? task.dueDate;
      if (anchor) {
        const date = parseTaskDay(anchor);
        return weekDates.some((wd) => isSameDay(wd, date));
      }
      return false;
    });
  }, [tasks, weekDates, estadoDe]);

  const multiDayTasks = useMemo(() => {
    return visibleTasks.filter(
      (t) => t.startDate && t.dueDate && !sameDueDay(t.startDate, t.dueDate)
    );
  }, [visibleTasks]);

  const singleDayTasks = useMemo(() => {
    return visibleTasks.filter(
      (t) => !t.startDate || !t.dueDate || sameDueDay(t.startDate, t.dueDate)
    );
  }, [visibleTasks]);

  const completar = (id: string) => {
    const task = visibleTasks.find((t) => t.id === id);
    if (task) handleToggle(task);
  };
  const papelera = (task: TaskTransport) => deleteTask(task.id);

  const { focusedTaskId } = useTaskKeyboardNavigation(visibleTasks, {
    onSelect: onEdit,
    onToggle: completar,
    onDelete: papelera,
  }, {
    enabled: !keyboardDisabled
  });

  const tactil = usePunteroGrueso();

  // startDate es timestamptz: se manda la medianoche LOCAL (no el día pelado,
  // que se guardaría a medianoche UTC y corre el día en zonas negativas).
  function moveToDay(taskId: string, dayISO: string) {
    updateTask({ taskId, data: { startDate: dayToLocalISO(dayISO) } });
  }

  // Mientras no se sabe el puntero (la hidratación) no se monta ninguna de las
  // dos semanas: un teléfono no llega a pedir la del arrastre.
  if (tactil === null) {
    return <p className="py-6 pl-(--margen) text-sm text-muted-foreground">Abriendo la semana</p>;
  }

  // Con el dedo, las siete columnas no caben o no se arrastran: un día a la
  // vez, y mover de día con una hoja con nombre. Lo decide el puntero: una
  // tableta táctil ancha también recibe la hoja.
  if (tactil) {
    return (
      <TaskPlanningMobileView
        weekDates={weekDates}
        weekOffset={weekOffset}
        monthHeading={monthHeading}
        weekNumber={weekNumber}
        singleDayTasks={singleDayTasks}
        multiDayTasks={multiDayTasks}
        struck={struck}
        onPrevWeek={() => setWeekOffset((v) => v - 1)}
        onNextWeek={() => setWeekOffset((v) => v + 1)}
        onResetWeek={() => setWeekOffset(0)}
        onToggle={completar}
        onDelete={papelera}
        onEdit={onEdit}
        onMoveToDay={moveToDay}
      />
    );
  }

  return (
    <TaskPlanningBoard
      systemId={systemId}
      weekDates={weekDates}
      weekOffset={weekOffset}
      monthHeading={monthHeading}
      weekNumber={weekNumber}
      singleDayTasks={singleDayTasks}
      multiDayTasks={multiDayTasks}
      focusedTaskId={focusedTaskId}
      struck={struck}
      keyboardDisabled={keyboardDisabled}
      onPrevWeek={() => setWeekOffset((v) => v - 1)}
      onNextWeek={() => setWeekOffset((v) => v + 1)}
      onResetWeek={() => setWeekOffset(0)}
      onToggle={completar}
      onDelete={papelera}
      onEdit={onEdit}
      onMoveToDay={moveToDay}
    />
  );
}
