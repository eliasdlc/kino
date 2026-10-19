"use client";

import { useState } from "react";
import { isBefore, startOfToday } from "date-fns";
import { CalendarClock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MarginRow } from "@/components/ui/margin-row";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useBulkMove } from "./tasks.hooks";
import { parseDueDate } from "./tasks.utils";
import { TaskRow, type TaskRowProps } from "./TaskRow";
import type { TaskTransport } from "./tasks.types";
import { LISTA_FILA_ALTO } from "./TasksSkeleton";

interface OverdueGroupProps {
  /** Las vencidas de ahora: las que cuenta el título y mueve "Mover todas". */
  tasks: TaskTransport[];
  /** Las filas que se pintan: las de ahora más las tachadas en esta visita, en su orden. */
  filas: readonly TaskTransport[];
  struck: ReadonlySet<string>;
  systemMap: Map<string, { id: string; name: string; color: string | null }>;
  onOpen: (task: TaskTransport) => void;
  onComplete: (task: TaskTransport) => void;
  /** La fila que tiene el foco del teclado (j y k recorren también las vencidas). */
  focusedTaskId?: string | null;
  /** Las acciones y la selección de cada fila, las mismas que en Todas las tareas. */
  filaDe?: (task: TaskTransport) => Pick<TaskRowProps, "actions" | "selection">;
}

const ACTIVE_STATUSES = new Set(["backlog", "week", "tomorrow", "today", "planning", "action"]);

const MOVES = [
  { status: "today", label: "Hoy" },
  { status: "tomorrow", label: "Mañana" },
  { status: "week", label: "Esta semana" },
] as const;

export function getOverdueTasks(tasks: TaskTransport[]): TaskTransport[] {
  const today = startOfToday();
  return tasks.filter(
    (t) =>
      t.dueDate &&
      ACTIVE_STATUSES.has(t.status) &&
      isBefore(parseDueDate(t.dueDate), today)
  );
}

/**
 * Las vencidas, arriba de la lista, como su propia sección de Diario: el
 * título con la cuenta y un hairline, las mismas filas que el resto, con sus
 * mismas acciones y su casilla de selección. Mover todas de golpe es una
 * operación con nombre: el botón abre una hoja con los tres destinos en
 * renglones de 48 px, igual en el teléfono que en escritorio. El título pliega
 * la sección. Las filas y el tachado los lleva la lista (`AllTasksList`), para
 * que el teclado recorra vencidas y todas como una sola lista.
 */
export function OverdueGroup({ tasks, filas, struck, systemMap, onOpen, onComplete, focusedTaskId, filaDe }: OverdueGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [moving, setMoving] = useState(false);
  const { mutate: bulkMove, isPending } = useBulkMove();

  if (filas.length === 0) return null;

  const ids = tasks.map((t) => t.id);

  return (
    <section aria-labelledby="vencidas-titulo">
      <div className="flex items-center justify-between gap-3 border-b border-input pb-[0.2rem]">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="focus-ring -ml-1 flex min-h-[2.85rem] min-w-0 items-center gap-2 rounded-full pr-2 pl-1 text-left"
          aria-expanded={!collapsed}
        >
          <h2 id="vencidas-titulo" className="font-display text-[1.25rem] leading-[1.15] font-bold tracking-[-0.02em]">
            Vencidas
          </h2>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-(--dur-toque) ease-(--ease-pluma)",
              collapsed && "-rotate-90",
            )}
            aria-hidden
          />
        </button>
        <span className="flex items-center gap-1">
          <span className="text-[0.84rem] text-muted-foreground tabular-nums">
            {tasks.length} tarea{tasks.length === 1 ? "" : "s"}
          </span>
          {tasks.length > 0 && (
            <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setMoving(true)} className="-mr-2">
              Mover todas
            </Button>
          )}
        </span>
      </div>

      {!collapsed && (
        <div>
          {filas.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              density="lista"
              className={LISTA_FILA_ALTO}
              struck={struck.has(t.id)}
              context={systemMap.get(t.systemId)?.name}
              focused={t.id === focusedTaskId}
              onComplete={() => onComplete(t)}
              onOpen={() => onOpen(t)}
              {...filaDe?.(t)}
            />
          ))}
        </div>
      )}

      <ResponsiveDialog open={moving} onOpenChange={setMoving}>
        <ResponsiveDialogContent className="sm:max-w-sm">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Mover las vencidas</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {tasks.length} tarea{tasks.length === 1 ? "" : "s"}. La fecha límite no cambia; cambia cuándo las haces.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div>
            {MOVES.map(({ status, label }) => (
              <MarginRow
                key={status}
                margin={<CalendarClock className="mt-[0.8rem] size-[1.15rem]" />}
                onClick={() => {
                  setMoving(false);
                  bulkMove({ taskIds: ids, status });
                }}
                className="min-h-[3.2rem] text-base font-semibold text-foreground"
              >
                A {label.toLowerCase()}
              </MarginRow>
            ))}
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </section>
  );
}
