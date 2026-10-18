"use client";

import { useId, useState } from "react";
import { useTasks, useToggleTask, useDeleteTaskWithUndo } from "@/features/tasks/tasks.hooks";
import { useFolders } from "@/features/folders/folders.hooks";
import { NewFolderInline } from "@/features/folders/NewFolderInline";
import { DefaultTaskCard } from "@/features/tasks/cards/DefaultTaskCard";
import { TaskDetailSheet } from "@/features/tasks/TaskDetailSheet";
import { CreateTaskDialog } from "@/features/tasks/CreateTaskDialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SYSTEM_TYPE_CONFIG } from "@/shared/lib/system-types";
import { ChevronDown } from "lucide-react";
import { MarginRow } from "@/components/ui/margin-row";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { IndexHead } from "@/features/notebooks/IndexHead";
import { joinMeta, toRoman } from "@/features/notebooks/index-format";
import { capitalize } from "@/shared/lib/system-manifest";
import { cn } from "@/lib/utils";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import type { SystemViewProps } from "./SystemDetailView";

/** Formatea el targetDate del milestone y calcula si está en riesgo (vencido y sin cerrar). */
function targetDateMeta(targetDate: string | undefined, isComplete: boolean) {
  if (!targetDate) return null;
  const ms = Date.parse(targetDate);
  if (Number.isNaN(ms)) return null;
  const label = new Date(ms).toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
  const atRisk = !isComplete && ms < Date.now();
  return { label, atRisk };
}

/**
 * Un milestone como fila de índice que se pliega: el numeral en el margen, el
 * nombre, lo hecho contra el total y la fecha objetivo en la meta, y debajo,
 * al desplegar, la barra de progreso y sus tareas. "En riesgo" va en coral y
 * siempre con la palabra.
 */
function MilestoneAccordion({
  label,
  index,
  tasks,
  systemId,
  targetDate,
  onToggle,
  onDelete,
  onEdit,
}: {
  label: string;
  /** El numeral del margen; null en la fila de lo que no tiene milestone, que no ocupa puesto en el índice. */
  index: number | null;
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
  const groupId = useId();
  const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <>
      <MarginRow
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={groupId}
        margin={
          index !== null ? (
            <span aria-hidden className="font-display text-base leading-none font-bold">
              {toRoman(index)}
            </span>
          ) : null
        }
        trailing={
          <ChevronDown
            aria-hidden
            className={cn("mx-3 size-5 transition-transform duration-(--dur-toque) ease-(--ease-pluma)", open && "rotate-180")}
          />
        }
      >
        <span className="block truncate font-semibold text-foreground">{label}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {target?.atRisk && <span className="font-semibold text-task-overdue">en riesgo, </span>}
          {joinMeta([`${done} de ${tasks.length} hechas`, target?.label])}
        </span>
      </MarginRow>

      {open && (
        <div id={groupId} role="group" aria-label={label} className="space-y-2 border-b border-border py-3 last:border-b-0">
          {tasks.length > 0 && (
            <div className="pl-(--margen)">
              <Progress value={pct} aria-label={`${done} de ${tasks.length} hechas`} />
            </div>
          )}
          {tasks.length === 0 ? (
            <p className="pl-(--margen) text-sm text-muted-foreground">Ninguna tarea todavía.</p>
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
    </>
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
      <div className="flex justify-end">
        <CreateTaskDialog systemId={system.id} />
      </div>

      <section aria-labelledby={`${system.id}-milestones`}>
        <IndexHead
          id={`${system.id}-milestones`}
          title={capitalize(folderRole.nounPlural)}
          trailing={
            <NewFolderInline
              systemId={system.id}
              label={folderRole.newLabel}
              placeholder={folderRole.placeholder}
              fields={folderRole.fields}
            />
          }
        />
        {folders.map((folder, i) => {
          const folderTasks = activeTasks.filter((t) => t.folderId === folder.id);
          return (
            <MilestoneAccordion
              key={folder.id}
              index={i + 1}
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

        {/* Tareas sin milestone */}
        {noMilestoneTasks.length > 0 && (
          <MilestoneAccordion
            index={null}
            label={`Sin ${folderRole.noun}`}
            tasks={noMilestoneTasks}
            systemId={system.id}
            onToggle={handleToggle}
            onDelete={(t) => deleteTask(t.id)}
            onEdit={setEditTask}
          />
        )}

        {folders.length === 0 && noMilestoneTasks.length === 0 && (
          <EmptyState
            className="pl-(--margen)"
            title={`Todavía no tienes ${folderRole.nounPlural}`}
            description={`Crea el primer ${folderRole.noun} y agrega tareas para ver cuánto falta.`}
          />
        )}
      </section>

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
