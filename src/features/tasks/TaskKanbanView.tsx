"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ArrowRightLeft, Trash2 } from "lucide-react";
import type { TaskTransport } from "./tasks.types";
import { useTasks, useFolderTasks, useToggleTask, useDeleteTaskWithUndo, useUpdateTask } from "./tasks.hooks";
import { useFolders } from "@/features/folders/folders.hooks";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { MarginRow } from "@/components/ui/margin-row";
import { Segmented } from "@/components/ui/segmented";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { SectionHead } from "@/features/dashboard/SectionHead";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTaskKeyboardNavigation } from "./useTaskKeyboardNavigation";
import { useSystemManifest } from "@/features/systems/systems.hooks";
import { tasksEmptyCopy } from "@/shared/lib/archetype-copy";
import { TaskRow } from "./TaskRow";
import { kanbanColumnOf, kanbanColumns, kanbanMoveData, type KanbanGroupBy } from "./kanban";

interface TaskKanbanViewProps {
  systemId: string;
  initialData: TaskTransport[];
  folderId?: string;
  folderInitialData?: TaskTransport[];
  onEdit?: (task: TaskTransport) => void;
  keyboardDisabled?: boolean;
  defaultGroupBy?: KanbanGroupBy;
}

/**
 * Las columnas con arrastre, aparte: `@dnd-kit` se descarga sólo en
 * escritorio y al abrir Acción.
 */
const TaskKanbanBoard = dynamic(() => import("./TaskKanbanBoard"), {
  ssr: false,
  loading: () => <p className="py-6 text-sm text-muted-foreground">Abriendo el tablero</p>,
});

const AGRUPAR = [
  { value: "energy", label: "Energía" },
  { value: "priority", label: "Prioridad" },
  { value: "project", label: "Proyecto" },
] as const;

/**
 * Acción: las tareas de la semana agrupadas por energía, prioridad o
 * proyecto, y el progreso de la semana como una cifra. En escritorio son
 * columnas con arrastre de ratón. En el teléfono, las mismas columnas son
 * secciones con título y hairline, y mover es una operación con nombre: la
 * acción "Mover a otra columna" abre una hoja con las columnas en renglones.
 */
export function TaskKanbanView({ systemId, initialData, folderId, folderInitialData, onEdit, keyboardDisabled, defaultGroupBy = "energy" }: TaskKanbanViewProps) {
  const systemQuery = useTasks(systemId, initialData);
  const folderQuery = useFolderTasks(systemId, folderId ?? "", folderInitialData);
  const { data: tasks } = folderId ? folderQuery : systemQuery;

  const { mutate: toggleTask } = useToggleTask(systemId, folderId);
  const { mutate: deleteTask } = useDeleteTaskWithUndo(systemId, folderId);
  const { mutate: updateTask } = useUpdateTask(systemId);
  const { data: folders = [] } = useFolders(systemId);
  const isMobile = useIsMobile();

  const [groupBy, setGroupBy] = useState<KanbanGroupBy>(defaultGroupBy);
  const [deleteTarget, setDeleteTarget] = useState<TaskTransport | null>(null);
  const [moviendo, setMoviendo] = useState<TaskTransport | null>(null);
  const manifest = useSystemManifest(systemId);
  const empty = tasksEmptyCopy(manifest, "action");

  const columns = kanbanColumns(groupBy, folders);

  // Las hechas cuentan para el progreso; las columnas enseñan sólo lo abierto.
  const actionableTasks = tasks?.filter(
    (t) => t.status === "today" || t.status === "tomorrow" || t.status === "week" || t.status === "done",
  ) ?? [];
  const activeTasks = actionableTasks.filter((t) => t.status !== "done");
  const tasksOf = (columnId: string) => activeTasks.filter((t) => kanbanColumnOf(t, groupBy) === columnId);

  const { focusedTaskId } = useTaskKeyboardNavigation(activeTasks, {
    onSelect: onEdit,
    onToggle: toggleTask,
    onDelete: setDeleteTarget,
  }, {
    enabled: !keyboardDisabled && deleteTarget === null && moviendo === null,
  });

  function move(task: TaskTransport, columnId: string) {
    updateTask({ taskId: task.id, data: kanbanMoveData(groupBy, columnId) });
  }

  if (!tasks || activeTasks.length === 0) {
    return <EmptyState className="pl-(--margen)" title={empty.title} description={empty.hint} />;
  }

  const doneCount = actionableTasks.length - activeTasks.length;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[1.25rem] leading-tight font-bold tracking-[-0.02em]">Progreso de la semana</h2>
          <p className="text-sm text-muted-foreground tabular-nums">
            {doneCount} de {actionableTasks.length} hechas
          </p>
        </div>
        <Segmented<KanbanGroupBy> aria-label="Agrupar por" value={groupBy} onValueChange={setGroupBy} options={AGRUPAR} />
      </div>

      {isMobile ? (
        <div className="space-y-5">
          {columns.map((column) => {
            const columnTasks = tasksOf(column.id);
            if (columnTasks.length === 0) return null;
            return (
              <section key={column.id} aria-label={column.label}>
                <SectionHead title={column.label} as="h3" count={`${columnTasks.length}`} />
                {columnTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    density="lista"
                    focused={task.id === focusedTaskId}
                    onComplete={() => toggleTask(task.id)}
                    onOpen={onEdit ? () => onEdit(task) : undefined}
                    actions={[
                      { label: "Mover a otra columna", icon: ArrowRightLeft, onSelect: () => setMoviendo(task) },
                      { label: "Mover a la papelera", icon: Trash2, destructive: true, onSelect: () => setDeleteTarget(task) },
                    ]}
                  />
                ))}
              </section>
            );
          })}
        </div>
      ) : (
        <TaskKanbanBoard
          systemId={systemId}
          groupBy={groupBy}
          columns={columns}
          tasksOf={tasksOf}
          focusedTaskId={focusedTaskId}
          keyboardDisabled={keyboardDisabled}
          onToggle={(id) => toggleTask(id)}
          onDelete={setDeleteTarget}
          onEdit={onEdit}
          onMove={move}
        />
      )}

      <ResponsiveDialog open={moviendo !== null} onOpenChange={(open) => !open && setMoviendo(null)}>
        <ResponsiveDialogContent className="sm:max-w-sm">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Mover a otra columna</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="line-clamp-2">{moviendo?.title}</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div>
            {columns.map((column) => {
              const actual = moviendo ? kanbanColumnOf(moviendo, groupBy) === column.id : false;
              return (
                <MarginRow
                  key={column.id}
                  margin={<ArrowRightLeft className="mt-[0.8rem] size-[1.15rem]" />}
                  trailing={actual ? "ahora" : undefined}
                  aria-disabled={actual || undefined}
                  onClick={() => {
                    if (!moviendo || actual) return;
                    move(moviendo, column.id);
                    setMoviendo(null);
                  }}
                  className={actual ? "min-h-[3.2rem] text-base font-semibold opacity-50" : "min-h-[3.2rem] text-base font-semibold text-foreground"}
                >
                  {column.label}
                </MarginRow>
              );
            })}
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

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
