"use client";

import { useState } from "react";
import { useUrlView } from "@/shared/hooks/use-url-view";
import { CreateTaskDialog } from "@/features/tasks/CreateTaskDialog";
import { TaskDetailSheet } from "@/features/tasks/TaskDetailSheet";
import { TaskWeekFocusView } from "@/features/tasks/TaskWeekFocusView";
import { TaskCalendarView } from "@/features/tasks/TaskCalendarView";
import { TaskPlanningView } from "@/features/tasks/TaskPlanningView";
import { TaskArchiveView } from "@/features/tasks/TaskArchiveView";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import { cn } from "@/lib/utils";

const VIEWS = ["esta-semana", "calendar", "planning", "archive"] as const;
type View = (typeof VIEWS)[number];

const LABELS: Record<View, { long: string; short: string }> = {
  "esta-semana": { long: "Esta semana", short: "Semana" },
  calendar: { long: "Calendario", short: "Calendario" },
  planning: { long: "Planificación", short: "Plan" },
  archive: { long: "Archivadas", short: "Archivo" },
};

/**
 * Las cuatro vistas de tareas, en texto subrayado en vez de cuatro cajas.
 *
 * La fila de pestañas rellenas se comía una franja entera del teléfono para
 * llegar a vistas que casi no se abren desde aquí. Esto sigue siendo visible y
 * tocable (44 px de alto), pero pesa lo que pesa una línea de texto.
 */
function TaskViewNav({ value, onChange }: { value: View; onChange: (next: View) => void }) {
  return (
    <div role="tablist" aria-label="Vistas de tareas" className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      {VIEWS.map((view) => {
        const active = value === view;
        return (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(view)}
            className={cn(
              "relative min-h-11 shrink-0 px-2 text-sm font-semibold transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="sm:hidden">{LABELS[view].short}</span>
            <span className="hidden sm:inline">{LABELS[view].long}</span>
            {active && <span aria-hidden className="absolute inset-x-2 bottom-1.5 h-0.5 rounded-full bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}

interface AcademicTaskViewsProps {
  systemId: string;
  initialTasks: TaskTransport[];
  /** Dentro de una clase, sus tareas; en el sistema, las del ciclo. */
  folderId?: string;
}

/**
 * El bloque de entregas y exámenes, igual en el sistema y dentro de una clase:
 * la misma navegación, las mismas vistas y el mismo sitio para crear.
 */
export function AcademicTaskViews({ systemId, initialTasks, folderId }: AcademicTaskViewsProps) {
  const [view, setView] = useUrlView(VIEWS, "esta-semana");
  const [editTask, setEditTask] = useState<TaskTransport | null>(null);
  const [highlight, setHighlight] = useState<{ id: string; nonce: number } | null>(null);

  function goToAction(taskId?: string) {
    setView("esta-semana");
    if (taskId) setHighlight({ id: taskId, nonce: Date.now() });
  }

  return (
    <>
      <div className="flex w-full flex-col gap-3">
        <div className="flex items-center gap-2 border-b border-border">
          <TaskViewNav value={view} onChange={setView} />
          <CreateTaskDialog systemId={systemId} folderId={folderId} />
        </div>

        {view === "esta-semana" && (
          <TaskWeekFocusView systemId={systemId} initialData={initialTasks} onEdit={setEditTask} highlight={highlight} />
        )}
        {view === "calendar" && (
          <TaskCalendarView systemId={systemId} initialData={initialTasks} onNavigateToAction={goToAction} />
        )}
        {view === "planning" && (
          <TaskPlanningView
            systemId={systemId}
            initialData={initialTasks}
            onEdit={setEditTask}
            keyboardDisabled={editTask !== null}
          />
        )}
        {view === "archive" && (
          <TaskArchiveView
            systemId={systemId}
            initialData={initialTasks}
            onEdit={setEditTask}
            keyboardDisabled={editTask !== null}
          />
        )}
      </div>

      <TaskDetailSheet
        task={editTask}
        systemId={systemId}
        open={editTask !== null}
        onOpenChange={(open) => {
          if (!open) setEditTask(null);
        }}
      />
    </>
  );
}
