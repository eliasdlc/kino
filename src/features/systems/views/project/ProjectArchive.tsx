"use client";

import { useState } from "react";
import { ChevronDown, Flag, Archive, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTasks, useToggleTask } from "@/features/tasks/tasks.hooks";
import { useDeleteSprint } from "@/features/sprints/sprints.hooks";
import { ProjectTaskCard } from "@/features/tasks/cards/ProjectTaskCard";
import type { Task } from "@/features/tasks/tasks.types";
import type { Sprint } from "@/features/sprints/sprints.types";

interface ProjectArchiveProps {
  systemId: string;
  initialData: Task[];
  sprints: Sprint[];
  onEdit?: (task: Task) => void;
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground font-mono shrink-0">{done}/{total}</span>
    </div>
  );
}

function SprintAccordion({
  sprint,
  tasks,
  systemId,
  onEdit,
  onDelete,
}: {
  sprint: Sprint;
  tasks: Task[];
  systemId: string;
  onEdit?: (task: Task) => void;
  onDelete: (sprint: Sprint) => void;
}) {
  const [open, setOpen] = useState(false);
  const { mutate: toggleTask } = useToggleTask(systemId);
  const done = tasks.filter((t) => t.status === "done").length;
  const closedAt = sprint.completedAt
    ? format(new Date(sprint.completedAt), "d 'de' MMM, yyyy", { locale: es })
    : null;

  return (
    <div className="rounded-xl border bg-muted/20">
      <div className="flex items-center">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex-1 min-w-0 flex items-center gap-3 p-4 text-left">
          <Flag size={16} className="shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold truncate">{sprint.name}</span>
              {closedAt && <span className="text-xs text-muted-foreground shrink-0">· cerrado {closedAt}</span>}
            </div>
            <ProgressBar done={done} total={tasks.length} />
          </div>
          <ChevronDown size={16} className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(sprint)}
          className="shrink-0 px-3 self-stretch text-muted-foreground hover:text-destructive"
          aria-label="Eliminar sprint"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-border/50 pt-3">
          {tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Este sprint no tenía tarjetas.</p>
          ) : (
            tasks.map((task) => (
              <ProjectTaskCard
                key={task.id}
                task={task}
                systemId={systemId}
                onToggle={(id) => toggleTask(id)}
                onDelete={() => {}}
                onEdit={onEdit}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Archivadas navegables POR sprint cerrado (no todo mezclado). */
export function ProjectArchive({ systemId, initialData, sprints, onEdit }: ProjectArchiveProps) {
  const { data: tasks = [] } = useTasks(systemId, initialData);
  const { mutate: deleteSprint } = useDeleteSprint(systemId);
  const [deleteTarget, setDeleteTarget] = useState<Sprint | null>(null);
  const completed = sprints.filter((s) => s.status === "completed");

  if (completed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-2 border border-dashed rounded-lg bg-card">
        <Archive size={24} className="text-muted-foreground" />
        <p className="text-base font-medium">Aún no hay sprints cerrados</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          Cuando cierres un sprint desde el board, aparecerá aquí con sus tarjetas agrupadas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {completed.map((sprint) => (
        <SprintAccordion
          key={sprint.id}
          sprint={sprint}
          tasks={tasks.filter((t) => t.sprintId === sprint.id && !t.deletedAt)}
          systemId={systemId}
          onEdit={onEdit}
          onDelete={setDeleteTarget}
        />
      ))}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar sprint"
        description={`"${deleteTarget?.name}" se eliminará del archivo. Sus tarjetas no se borran: quedan sin sprint asignado.`}
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
