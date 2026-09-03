"use client";

import { useState } from "react";
import { useTasks, useToggleTask, useDeleteTaskWithUndo } from "@/features/tasks/tasks.hooks";
import { useFolders } from "@/features/folders/folders.hooks";
import { NewFolderInline } from "@/features/folders/NewFolderInline";
import { DefaultTaskCard } from "@/features/tasks/cards/DefaultTaskCard";
import { TaskDetailSheet } from "@/features/tasks/TaskDetailSheet";
import { CreateTaskDialog } from "@/features/tasks/CreateTaskDialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SYSTEM_TYPE_CONFIG } from "@/shared/lib/system-types";
import { ChevronDown, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import type { SystemViewProps } from "./SystemDetailView";

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground font-mono shrink-0">{done}/{total}</span>
    </div>
  );
}

/** Formatea el targetDate del milestone y calcula si está en riesgo (vencido y sin cerrar). */
function targetDateMeta(targetDate: string | undefined, isComplete: boolean) {
  if (!targetDate) return null;
  const ms = Date.parse(targetDate);
  if (Number.isNaN(ms)) return null;
  const label = new Date(ms).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
  const atRisk = !isComplete && ms < Date.now();
  return { label, atRisk };
}

function MilestoneAccordion({
  label,
  tasks,
  systemId,
  targetDate,
  onToggle,
  onDelete,
  onEdit,
}: {
  label: string;
  tasks: TaskTransport[];
  systemId: string;
  targetDate?: string;
  onToggle: (taskId: string) => void;
  onDelete: (task: TaskTransport) => void;
  onEdit: (task: TaskTransport) => void;
}) {
  const done = tasks.filter((t) => t.status === "done").length;
  // Un milestone 100% completado arranca colapsado para reducir ruido.
  const isComplete = tasks.length > 0 && done === tasks.length;
  const [open, setOpen] = useState(!isComplete);
  const target = targetDateMeta(targetDate, isComplete);

  return (
    <div className="rounded-xl border bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <Target size={16} className="shrink-0 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{label}</span>
            {target && (
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                  target.atRisk
                    ? "bg-destructive/15 text-destructive"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {target.atRisk ? "En riesgo · " : ""}{target.label}
              </span>
            )}
          </div>
          <ProgressBar done={done} total={tasks.length} />
        </div>
        <ChevronDown
          size={16}
          className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-border/50 pt-3">
          {tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              Ninguna tarea aún. → Agregar.
            </p>
          ) : (
            tasks.map((task) => (
              <DefaultTaskCard
                key={task.id}
                task={task}
                systemId={systemId}
                systemType="entrepreneurial"
                onToggle={onToggle}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function SystemEntrepreneurialView({ system, initialTasks }: SystemViewProps) {
  const { data: allTasks = [] } = useTasks(system.id, initialTasks);
  const { data: folders = [] } = useFolders(system.id);
  const { mutate: toggleTask } = useToggleTask(system.id);
  const { mutate: deleteTask } = useDeleteTaskWithUndo(system.id);

  const [editTask, setEditTask] = useState<TaskTransport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskTransport | null>(null);

  const activeTasks = allTasks.filter((t) => !t.deletedAt);

  function handleToggle(taskId: string) {
    toggleTask(taskId);
  }

  const noMilestoneTasks = activeTasks.filter((t) => !t.folderId);
  const folderRole = SYSTEM_TYPE_CONFIG.entrepreneurial.folderRole!;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <NewFolderInline
          systemId={system.id}
          label={folderRole.newLabel}
          placeholder={folderRole.placeholder}
          icon={folderRole.icon}
          fields={folderRole.fields}
        />
        <div className="ml-auto">
          <CreateTaskDialog systemId={system.id} />
        </div>
      </div>

      {/* Milestones (folders) */}
      <div className="space-y-3">
        {folders.map((folder) => {
          const folderTasks = activeTasks.filter((t) => t.folderId === folder.id);
          return (
            <MilestoneAccordion
              key={folder.id}
              label={folder.name}
              tasks={folderTasks}
              systemId={system.id}
              targetDate={typeof folder.metadata?.targetDate === "string" ? folder.metadata.targetDate : undefined}
              onToggle={handleToggle}
              onDelete={(t) => setDeleteTarget(t)}
              onEdit={setEditTask}
            />
          );
        })}

        {/* Tasks without a milestone */}
        {noMilestoneTasks.length > 0 && (
          <MilestoneAccordion
            label="Sin milestone"
            tasks={noMilestoneTasks}
            systemId={system.id}
            onToggle={handleToggle}
            onDelete={(t) => deleteTask(t.id)}
            onEdit={setEditTask}
          />
        )}

        {folders.length === 0 && noMilestoneTasks.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">
            Crea un milestone para tu startup y agrega tareas para visualizar el progreso.
          </div>
        )}
      </div>

      <TaskDetailSheet
        task={editTask}
        systemId={system.id}
        open={editTask !== null}
        onOpenChange={(open) => { if (!open) setEditTask(null); }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Mover a la papelera"
        description={`"${deleteTarget?.title}" se moverá a la papelera.`}
        confirmLabel="Mover a la papelera"
        onConfirm={() => {
          if (deleteTarget) deleteTask(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
