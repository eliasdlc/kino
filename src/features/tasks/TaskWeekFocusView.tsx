"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { differenceInCalendarDays, startOfToday } from "date-fns";
import { useTasks, useToggleTask, useDeleteTaskWithUndo } from "./tasks.hooks";
import { TaskCard } from "./TaskCard";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { parseDueDate } from "./tasks.utils";
import type { Task } from "./tasks.types";

interface TaskWeekFocusViewProps {
  systemId: string;
  initialData: Task[];
  onEdit?: (task: Task) => void;
  /** Tarea a resaltar al entrar (ej. tras un click desde el calendario). */
  highlight?: { id: string; nonce: number } | null;
}

/** Tope duro de Kino: nunca más de 3 cosas "para hoy". */
const HOY_LIMIT = 3;

const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function daysUntil(task: Task, today: Date): number {
  if (!task.dueDate) return Number.POSITIVE_INFINITY;
  return differenceInCalendarDays(parseDueDate(task.dueDate), today);
}

function Section({
  title,
  hint,
  tasks,
  renderTask,
}: {
  title: string;
  hint?: string;
  tasks: Task[];
  renderTask: (task: Task) => ReactNode;
}) {
  if (tasks.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2 px-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="space-y-2">{tasks.map(renderTask)}</div>
    </div>
  );
}

/**
 * EstaSemanaTab — la vista por defecto de Academic. Responde "¿estoy bien?"
 * con un runway simple (días hasta la entrega), no un calendario. Hoy se limita
 * a 3; lo demás tiene tiempo. La línea de arriba da la certeza emocional.
 */
export function TaskWeekFocusView({ systemId, initialData, onEdit, highlight }: TaskWeekFocusViewProps) {
  const { data: allTasks = [] } = useTasks(systemId, initialData);
  const { mutate: toggleTask } = useToggleTask(systemId);
  const { mutate: deleteTask } = useDeleteTaskWithUndo(systemId);

  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  // Resaltado temporal: hace scroll a la tarea y la marca por ~1s.
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!highlight) return;
    setHighlightedId(highlight.id);
    rowRefs.current.get(highlight.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setHighlightedId(null), 1000);
    return () => clearTimeout(t);
  }, [highlight]);

  const today = startOfToday();
  const active = allTasks.filter((t) => !t.deletedAt && t.status !== "done" && t.status !== "archived");

  // Candidatas a "Hoy": vencidas o que vencen hoy. Vencidas primero, luego prioridad.
  const urgent = active
    .filter((t) => daysUntil(t, today) <= 0)
    .sort((a, b) => {
      const da = daysUntil(a, today);
      const db = daysUntil(b, today);
      if (da !== db) return da - db; // más vencida primero
      return (PRIORITY_RANK[a.priority ?? "medium"] ?? 2) - (PRIORITY_RANK[b.priority ?? "medium"] ?? 2);
    });

  const hoy = urgent.slice(0, HOY_LIMIT);
  const hoyOverflow = urgent.length - hoy.length;
  const overdueCount = active.filter((t) => daysUntil(t, today) < 0).length;

  const tieneTiempo = active
    .filter((t) => {
      const d = daysUntil(t, today);
      return d >= 1 && d <= 7;
    })
    .sort((a, b) => daysUntil(a, today) - daysUntil(b, today));

  const masAdelante = active
    .filter((t) => daysUntil(t, today) > 7) // incluye sin fecha (Infinity)
    .sort((a, b) => daysUntil(a, today) - daysUntil(b, today));

  const reassurance =
    overdueCount > 0
      ? `Tienes ${overdueCount} atrasada${overdueCount !== 1 ? "s" : ""} — arranquemos por ahí, con calma.`
      : urgent.length === 0
        ? "Nada vence hoy. Vas con tiempo. ✨"
        : `Vas al día — ${hoy.length} para hoy, lo demás tiene espacio.`;

  function renderTask(task: Task) {
    return (
      <div
        key={task.id}
        ref={(el) => {
          if (el) rowRefs.current.set(task.id, el);
          else rowRefs.current.delete(task.id);
        }}
      >
        <TaskCard
          task={task}
          systemId={systemId}
          systemType="academic"
          isFocused={task.id === highlightedId}
          onToggle={(id) => toggleTask(id)}
          onDelete={() => setDeleteTarget(task)}
          onEdit={onEdit}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Línea cálida — la certeza emocional */}
      <div className="rounded-xl border bg-muted/30 px-4 py-3">
        <p className="text-sm font-medium">{reassurance}</p>
      </div>

      {active.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          Semana despejada. Cuando agregues entregas, aparecerán aquí ordenadas por cuánto tiempo tienes.
        </div>
      ) : (
        <>
          <Section
            title="Hoy"
            hint={hoyOverflow > 0 ? `+${hoyOverflow} más, pero el foco son ${HOY_LIMIT}` : `máx ${HOY_LIMIT}`}
            tasks={hoy}
            renderTask={renderTask}
          />
          <Section title="Tiene tiempo" hint="esta semana" tasks={tieneTiempo} renderTask={renderTask} />
          <Section title="Más adelante" tasks={masAdelante} renderTask={renderTask} />
        </>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Move to trash"
        description={`"${deleteTarget?.title}" will be moved to the trash.`}
        confirmLabel="Move to trash"
        onConfirm={() => {
          if (deleteTarget) deleteTask(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
