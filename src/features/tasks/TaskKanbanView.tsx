"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ArrowRightLeft, Trash2 } from "lucide-react";
import type { TaskTransport } from "./tasks.types";
import { useTasks, useFolderTasks, useToggleTask, useDeleteTaskWithUndo, useUpdateTask } from "./tasks.hooks";
import { useFolders } from "@/features/folders/folders.hooks";
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
import { useTaskKeyboardNavigation } from "./useTaskKeyboardNavigation";
import { useSystemManifest } from "@/features/systems/systems.hooks";
import { tasksEmptyCopy } from "@/shared/lib/archetype-copy";
import { TaskRow } from "./TaskRow";
import { useTacharEnSitio } from "./useTachar";
import { usePunteroGrueso } from "./use-puntero-grueso";
import { kanbanColumnOf, kanbanColumns, kanbanMoveData, type KanbanColumn, type KanbanGroupBy } from "./kanban";

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
 * proyecto, y el progreso de la semana como una cifra. Con ratón son columnas
 * con arrastre. Con el dedo (teléfono o tableta: lo decide el puntero, no el
 * ancho), las mismas columnas son secciones con título y hairline, y mover es
 * una operación con nombre: "Mover a otra columna" abre una hoja con las
 * columnas en renglones. Mientras no se sabe el puntero (la hidratación), no
 * se monta ninguna de las dos: así un teléfono nunca pide el tablero.
 *
 * Completar tacha la fila en su columna con Deshacer de cuatro segundos; la
 * hecha se va en la siguiente visita. Mover a la papelera no pregunta: el
 * aviso trae Deshacer.
 */
export function TaskKanbanView({ systemId, initialData, folderId, folderInitialData, onEdit, keyboardDisabled, defaultGroupBy = "energy" }: TaskKanbanViewProps) {
  const systemQuery = useTasks(systemId, initialData);
  const folderQuery = useFolderTasks(systemId, folderId ?? "", folderInitialData);
  const { data: tasks } = folderId ? folderQuery : systemQuery;

  const { mutate: toggleTask } = useToggleTask(systemId, folderId);
  const { mutate: deleteTask } = useDeleteTaskWithUndo(systemId, folderId);
  const { mutate: updateTask } = useUpdateTask(systemId);
  const { data: folders = [] } = useFolders(systemId);
  const tactil = usePunteroGrueso();
  const { struck, handleToggle, estadoDe } = useTacharEnSitio((id) => toggleTask(id));

  const [groupBy, setGroupBy] = useState<KanbanGroupBy>(defaultGroupBy);
  // Con una hoja de mover abierta el teclado del tablero calla.
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const manifest = useSystemManifest(systemId);
  const empty = tasksEmptyCopy(manifest, "action");

  const columns = kanbanColumns(groupBy, folders);

  // Las hechas cuentan para el progreso; las columnas enseñan sólo lo abierto.
  // Las tachadas en esta visita siguen en su columna (filtran con su estado
  // de antes); el progreso cuenta lo hecho de verdad.
  const actionableTasks = tasks?.filter(
    (t) => t.status === "today" || t.status === "tomorrow" || t.status === "week" || t.status === "done",
  ) ?? [];
  const activeTasks = actionableTasks.filter((t) => estadoDe(t) !== "done");
  const tasksOf = (columnId: string) => activeTasks.filter((t) => kanbanColumnOf(t, groupBy) === columnId);
  const completar = (id: string) => {
    const task = activeTasks.find((t) => t.id === id);
    if (task) handleToggle(task);
  };
  const papelera = (task: TaskTransport) => deleteTask(task.id);

  const { focusedTaskId } = useTaskKeyboardNavigation(activeTasks, {
    onSelect: onEdit,
    onToggle: completar,
    onDelete: papelera,
  }, {
    enabled: !keyboardDisabled && !hojaAbierta,
  });

  function move(task: TaskTransport, columnId: string) {
    updateTask({ taskId: task.id, data: kanbanMoveData(groupBy, columnId) });
  }

  if (!tasks || activeTasks.length === 0) {
    return <EmptyState className="pl-(--margen)" title={empty.title} description={empty.hint} />;
  }

  const doneCount = actionableTasks.filter((t) => t.status === "done").length;

  return (
    <div className="flex w-full flex-col gap-4">
      <div>
        <SectionHead title="Progreso de la semana" count={`${doneCount} de ${actionableTasks.length} hechas`} />
        <Segmented<KanbanGroupBy>
          aria-label="Agrupar por"
          value={groupBy}
          onValueChange={setGroupBy}
          options={AGRUPAR}
          className="mt-3 max-md:ml-(--margen)"
        />
      </div>

      {tactil === null ? (
        <p className="py-6 pl-(--margen) text-sm text-muted-foreground">Abriendo el tablero</p>
      ) : tactil ? (
        <KanbanSecciones
          columns={columns}
          tasksOf={tasksOf}
          groupBy={groupBy}
          struck={struck}
          focusedTaskId={focusedTaskId}
          onComplete={handleToggle}
          onEdit={onEdit}
          onTrash={papelera}
          onMove={move}
          onSheetChange={setHojaAbierta}
        />
      ) : (
        <TaskKanbanBoard
          systemId={systemId}
          groupBy={groupBy}
          columns={columns}
          tasksOf={tasksOf}
          focusedTaskId={focusedTaskId}
          struck={struck}
          keyboardDisabled={keyboardDisabled}
          onToggle={completar}
          onDelete={papelera}
          onEdit={onEdit}
          onMove={move}
        />
      )}


    </div>
  );
}

interface KanbanSeccionesProps {
  columns: KanbanColumn[];
  tasksOf: (columnId: string) => TaskTransport[];
  groupBy: KanbanGroupBy;
  struck: ReadonlySet<string>;
  focusedTaskId?: string | null;
  onComplete: (task: TaskTransport) => void;
  onEdit?: (task: TaskTransport) => void;
  onTrash: (task: TaskTransport) => void;
  onMove: (task: TaskTransport, columnId: string) => void;
  /** Avisa cuándo se abre o se cierra la hoja de mover (el teclado del tablero calla mientras). */
  onSheetChange?: (open: boolean) => void;
}

/**
 * Acción con el dedo: las columnas son secciones con título y hairline y las
 * tareas son filas de tarea. Mover es la operación con nombre "Mover a otra
 * columna", que abre una hoja con las columnas en renglones de 48 px y escribe
 * el mismo cambio que el arrastre. La hoja conserva la última tarea mientras
 * se recoge: si el título se vaciara al cerrar, la descripción saltaría a
 * mitad de la salida.
 */
export function KanbanSecciones({ columns, tasksOf, groupBy, struck, focusedTaskId, onComplete, onEdit, onTrash, onMove, onSheetChange }: KanbanSeccionesProps) {
  const [moviendo, setMoviendoEstado] = useState<TaskTransport | null>(null);
  const [ultima, setUltima] = useState<TaskTransport | null>(null);
  if (moviendo && moviendo !== ultima) setUltima(moviendo);
  const setMoviendo = (task: TaskTransport | null) => {
    setMoviendoEstado(task);
    onSheetChange?.(task !== null);
  };

  return (
    <>
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
                  struck={struck.has(task.id)}
                  onComplete={() => onComplete(task)}
                  onOpen={onEdit ? () => onEdit(task) : undefined}
                  actions={[
                    { label: "Mover a otra columna", icon: ArrowRightLeft, onSelect: () => setMoviendo(task) },
                    { label: "Mover a la papelera", icon: Trash2, destructive: true, onSelect: () => onTrash(task) },
                  ]}
                />
              ))}
            </section>
          );
        })}
      </div>

      <ResponsiveDialog open={moviendo !== null} onOpenChange={(open) => !open && setMoviendo(null)}>
        <ResponsiveDialogContent className="sm:max-w-sm">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Mover a otra columna</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="line-clamp-2">{ultima?.title}</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div>
            {columns.map((column) => {
              const actual = ultima ? kanbanColumnOf(ultima, groupBy) === column.id : false;
              return (
                <MarginRow
                  key={column.id}
                  margin={<ArrowRightLeft className="mt-[0.8rem] size-[1.15rem]" />}
                  trailing={actual ? "ahora" : undefined}
                  aria-disabled={actual || undefined}
                  onClick={() => {
                    if (!moviendo || actual) return;
                    onMove(moviendo, column.id);
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
    </>
  );
}
