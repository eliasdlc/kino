"use client";

import { Progress } from "@/components/ui/progress";

import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useDeleteTaskWithUndo, useTasks, useToggleTask } from "@/features/tasks/tasks.hooks";
import { useDeleteSprint } from "@/features/sprints/sprints.hooks";
import { ProjectTaskCard } from "@/features/tasks/cards/ProjectTaskCard";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import type { SprintTransport } from "@/features/sprints/sprints.types";

interface ProjectArchiveProps {
  systemId: string;
  initialData: TaskTransport[];
  sprints: SprintTransport[];
  onEdit?: (task: TaskTransport) => void;
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <span className="mt-1.5 flex items-center gap-2">
      <Progress value={pct} className="flex-1" aria-label={`${done} de ${total} hechas`} />
      <span className="shrink-0 text-xs text-mute tabular-nums">{done}/{total}</span>
    </span>
  );
}

/**
 * Un ciclo cerrado es una fila del índice: su numeral en el margen, el nombre,
 * cuándo se cerró y cuánto se hizo, y se pliega para enseñar sus tarjetas.
 * Sin caja: la fila se separa con el hairline, como las carpetas.
 */
function SprintAccordion({
  sprint,
  index,
  tasks,
  systemId,
  onEdit,
  onDelete,
}: {
  sprint: SprintTransport;
  index: number;
  tasks: TaskTransport[];
  systemId: string;
  onEdit?: (task: TaskTransport) => void;
  onDelete: (sprint: SprintTransport) => void;
}) {
  const [open, setOpen] = useState(false);
  const { mutate: toggleTask } = useToggleTask(systemId);
  // Eliminar una tarjeta archivada la manda a la papelera con su Deshacer,
  // como en el tablero: antes la opción estaba en el menú y no hacía nada.
  const { mutate: deleteTask } = useDeleteTaskWithUndo(systemId);
  const done = tasks.filter((t) => t.status === "done").length;
  const closedAt = sprint.completedAt
    ? format(new Date(sprint.completedAt), "d 'de' MMM, yyyy", { locale: es })
    : null;
  const panelId = `ciclo-${sprint.id}`;

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="grid grid-cols-[var(--margen)_1fr_auto] items-center">
        <span aria-hidden className="flex justify-center self-start pt-[0.85rem] text-sm text-mute tabular-nums">
          {index}
        </span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="press flex min-h-[3.4rem] min-w-0 items-center gap-2 py-2 text-left transition-[background-color,transform] duration-(--dur-toque) ease-(--ease-pluma) focus-ring"
        >
          <span className="block min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="truncate text-base font-semibold">{sprint.name}</span>
              {closedAt && <span className="shrink-0 text-xs text-muted-foreground">cerrado el {closedAt}</span>}
            </span>
            <ProgressBar done={done} total={tasks.length} />
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-(--dur-toque) ease-(--ease-pluma)",
              open && "rotate-180",
            )}
          />
        </button>
        <button
          type="button"
          onClick={() => onDelete(sprint)}
          className="ml-1 flex size-[2.85rem] shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-(--dur-toque) hover:text-destructive focus-ring md:pointer-fine:size-9"
          aria-label={`Eliminar el ciclo ${sprint.name}`}
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
      </div>

      {open && (
        <div id={panelId} className="space-y-2 pb-4 pl-(--margen)">
          {tasks.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Este ciclo no tenía tarjetas.</p>
          ) : (
            tasks.map((task) => (
              <ProjectTaskCard
                key={task.id}
                task={task}
                systemId={systemId}
                onToggle={(id) => toggleTask(id)}
                onDelete={(t) => deleteTask(t.id)}
                onEdit={onEdit}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Archivadas navegables por ciclo cerrado, no todo mezclado. */
export function ProjectArchive({ systemId, initialData, sprints, onEdit }: ProjectArchiveProps) {
  const { data: tasks = [] } = useTasks(systemId, initialData);
  const { mutate: deleteSprint } = useDeleteSprint(systemId);
  const [deleteTarget, setDeleteTarget] = useState<SprintTransport | null>(null);
  const completed = sprints.filter((s) => s.status === "completed");

  if (completed.length === 0) {
    return (
      <EmptyState
        className="pl-(--margen)"
        title="Aún no hay ciclos cerrados"
        description="Cuando cierres un ciclo desde el tablero, aparece aquí con sus tarjetas agrupadas."
      />
    );
  }

  return (
    <div>
      {completed.map((sprint, i) => (
        <SprintAccordion
          key={sprint.id}
          index={i + 1}
          sprint={sprint}
          tasks={tasks.filter((t) => t.sprintId === sprint.id && !t.deletedAt)}
          systemId={systemId}
          onEdit={onEdit}
          onDelete={setDeleteTarget}
        />
      ))}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar ciclo"
        description={`"${deleteTarget?.name}" se eliminará del archivo. Sus tarjetas no se borran: quedan sin ciclo asignado.`}
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deleteTarget) deleteSprint(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
