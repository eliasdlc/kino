"use client";

import { useState } from "react";
import { Link2, Plus } from "lucide-react";
import { api } from "@convex/_generated/api";
import { getConvexClient } from "@/shared/convex/client";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { MarginRow } from "@/components/ui/margin-row";
import { SectionHead } from "@/features/dashboard/SectionHead";
import { MargenDeUnaLinea, UNA_LINEA } from "@/shared/components/una-linea";
import { useTasks } from "@/features/tasks/tasks.hooks";
import { useToggleTask } from "@/features/tasks/tasks.hooks";
import { useLinkedTasks, useLinkTask, useUnlinkTask } from "./pages.hooks";
import { ESTADO_TAREA, LinkedTaskCard } from "./LinkedTaskCard";
import { TaskDetailSheet } from "@/features/tasks/TaskDetailSheet";
import { CreateTaskDialog } from "@/features/tasks/CreateTaskDialog";
import type { LinkedTaskTransport } from "./pages.types";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import { Skeleton } from "@/components/ui/skeleton";

interface LinkedTasksPanelProps {
  pageId: string;
  systemId: string;
}

/**
 * Las tareas enlazadas a la página: el título de sección, las filas de
 * `LinkedTaskCard` y al final las dos acciones como filas de margen (vincular
 * una que ya existe, crear una que nace vinculada), igual que «Fijar una
 * referencia» en la mesa. Vincular abre una hoja con nombre en el teléfono
 * y un diálogo en escritorio, nunca un popover que el teclado tape.
 */
export function LinkedTasksPanel({ pageId, systemId }: LinkedTasksPanelProps) {
  const { data: linked = [], isLoading } = useLinkedTasks(pageId);
  const { data: allTasks = [] } = useTasks(systemId, []);
  const { mutate: linkTask } = useLinkTask(pageId);
  const { mutate: unlinkTask } = useUnlinkTask(pageId);
  const { mutate: toggleTask } = useToggleTask(systemId);
  const [vincularAbierto, setVincularAbierto] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Full task data for the edit sheet: fetched on-demand when user clicks edit
  const [editTask, setEditTask] = useState<TaskTransport | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const linkedIds = new Set(linked.map((t) => t.id));
  const visibleLinked = linked;
  const available = allTasks.filter((t) => !linkedIds.has(t.id));

  // When user clicks edit on a linked task, fetch the full TaskTransport object
  async function handleEdit(linkedTask: LinkedTaskTransport) {
    try {
      setEditTask(await getConvexClient().query(api.tasks.byId, { id: linkedTask.id }));
      setEditSheetOpen(true);
    } catch {
      // Fallback: build a partial task from linked data to still open the sheet
      // This covers network issues: the sheet will still work for most fields
      setEditTask({
        ...linkedTask,
        userId: "",
        recurrenceRule: null,
        recurrenceParentId: null,
        externalSource: null,
        sortIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        deletedAt: null,
      } as TaskTransport);
      setEditSheetOpen(true);
    }
  }

  // Auto-link a newly created task to this page
  function handleTaskCreated(task: TaskTransport) {
    linkTask(task.id);
  }

  return (
    <div className="space-y-1">
      <SectionHead as="h3" title="Tareas vinculadas" count={visibleLinked.length || undefined} />

      <CreateTaskDialog
        systemId={systemId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onTaskCreated={handleTaskCreated}
      />

      <ResponsiveDialog open={vincularAbierto} onOpenChange={setVincularAbierto}>
        <ResponsiveDialogContent className="max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Vincular una tarea</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Queda enlazada a esta página y la ves desde aquí.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {available.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">
              Todas las tareas de este sistema ya están vinculadas, o todavía no hay ninguna.
            </p>
          ) : (
            <div className="max-h-[55dvh] overflow-y-auto">
              {available.map((task) => (
                <MarginRow
                  key={task.id}
                  onClick={() => {
                    linkTask(task.id);
                    setVincularAbierto(false);
                  }}
                  className={UNA_LINEA}
                  margin={<MargenDeUnaLinea><Link2 aria-hidden className="size-4" /></MargenDeUnaLinea>}
                  trailing={ESTADO_TAREA[task.status] ?? null}
                >
                  <span className="block truncate text-base text-foreground">{task.title}</span>
                </MarginRow>
              ))}
            </div>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {isLoading && (
        <div aria-busy className="space-y-px">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-[3.4rem] w-full rounded-md" />
          ))}
        </div>
      )}

      {!isLoading && visibleLinked.length === 0 && (
        <p className="py-3 text-sm text-muted-foreground">
          Ninguna tarea apunta a esta página. Vincula una o crea la siguiente aquí abajo.
        </p>
      )}

      {!isLoading && visibleLinked.length > 0 && (
        <div>
          {visibleLinked.map((task: LinkedTaskTransport) => (
            <LinkedTaskCard
              key={task.id}
              task={task}
              onToggle={() => toggleTask(task.id)}
              onEdit={() => handleEdit(task)}
              onUnlink={() => unlinkTask(task.id)}
            />
          ))}
        </div>
      )}

      <MarginRow
        onClick={() => setVincularAbierto(true)}
        className={UNA_LINEA}
        margin={<MargenDeUnaLinea><Link2 aria-hidden className="size-5" /></MargenDeUnaLinea>}
      >
        <span className="block text-base text-foreground">Vincular una tarea</span>
      </MarginRow>
      <MarginRow
        onClick={() => setCreateOpen(true)}
        className={UNA_LINEA}
        margin={<MargenDeUnaLinea><Plus aria-hidden className="size-5" /></MargenDeUnaLinea>}
      >
        <span className="block text-base text-foreground">Nueva tarea, ya vinculada</span>
      </MarginRow>

      <TaskDetailSheet
        task={editTask}
        systemId={systemId}
        open={editSheetOpen}
        onOpenChange={(open) => {
          setEditSheetOpen(open);
          if (!open) setEditTask(null);
        }}
      />
    </div>
  );
}

