"use client";

import { useState } from "react";
import { CalendarClock, Check, Flag, ListChecks, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarginRow } from "@/components/ui/margin-row";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useBulkMove, useBulkUpdate } from "./tasks.hooks";
import { type TaskStatus } from "./tasks.state-machine";
import { type TaskPriority } from "./tasks.types";
import { PRIORITY_WORD } from "./task-vocab";

interface BulkActionBarProps {
  selectedIds: Set<string>;
  onClear: () => void;
  onVaciar?: () => void;
}

const DATE_OPTIONS = [
  { value: "today", label: "Hoy" },
  { value: "tomorrow", label: "Mañana" },
  { value: "week", label: "Esta semana" },
] as const;

const PRIORITY_OPTIONS = (["critical", "high", "medium", "low"] as const).map((value) => ({
  value,
  label: PRIORITY_WORD[value],
}));

type Hoja = "fechar" | "prioridad" | null;

/**
 * La barra de la selección múltiple: la cuenta en tinta y las operaciones con
 * nombre, en botones de 48 px. Fechar y Prioridad abren una hoja con sus
 * opciones en renglones (en el teléfono, la hoja inferior), no un menú
 * flotante que pide puntería.
 */
export function BulkActionBar({ selectedIds, onClear, onVaciar }: BulkActionBarProps) {
  const ids = [...selectedIds];
  const count = ids.length;
  const [hoja, setHoja] = useState<Hoja>(null);

  const { mutate: bulkMove, isPending: movePending } = useBulkMove();
  const { mutate: bulkUpdate, isPending: updatePending } = useBulkUpdate();
  const isPending = movePending || updatePending;

  if (count === 0) return null;

  function move(status: TaskStatus) {
    setHoja(null);
    bulkMove({ taskIds: ids, status }, { onSuccess: onClear });
  }

  function update(priority: TaskPriority) {
    setHoja(null);
    bulkUpdate({ taskIds: ids, priority }, { onSuccess: onClear });
  }

  const opciones =
    hoja === "fechar"
      ? DATE_OPTIONS.map((o) => ({ key: o.value, label: o.label, icon: CalendarClock, run: () => move(o.value) }))
      : PRIORITY_OPTIONS.map((o) => ({ key: o.value, label: o.label, icon: Flag, run: () => update(o.value) }));

  return (
    <div role="toolbar" aria-label="Acciones de la selección" className="flex flex-wrap items-center gap-1.5 border-y border-border py-2 pl-(--margen)">
      <span className="mr-1 text-sm font-semibold text-foreground tabular-nums">
        {count} seleccionada{count !== 1 ? "s" : ""}
      </span>
      <Button size="sm" variant="secondary" disabled={isPending} onClick={() => setHoja("fechar")}>
        <CalendarClock className="size-4" />
        Fechar
      </Button>
      <Button size="sm" variant="secondary" disabled={isPending} onClick={() => setHoja("prioridad")}>
        <Flag className="size-4" />
        Prioridad
      </Button>
      <Button size="sm" variant="secondary" disabled={isPending} onClick={() => move("done")}>
        <Check className="size-4" />
        Completar
      </Button>
      {onVaciar && (
        <Button size="sm" variant="secondary" disabled={isPending} onClick={onVaciar}>
          <ListChecks className="size-4" />
          Repasar una a una
        </Button>
      )}
      <Button size="icon-sm" variant="ghost" onClick={onClear} aria-label="Limpiar selección" className="ml-auto">
        <X />
      </Button>

      <ResponsiveDialog open={hoja !== null} onOpenChange={(open) => !open && setHoja(null)}>
        <ResponsiveDialogContent className="sm:max-w-sm">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{hoja === "fechar" ? "Fechar" : "Prioridad"}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {count} tarea{count !== 1 ? "s" : ""} seleccionada{count !== 1 ? "s" : ""}.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div>
            {opciones.map(({ key, label, icon: Icon, run }) => (
              <MarginRow
                key={key}
                margin={<Icon className="mt-[0.55rem] size-[1.15rem]" />}
                onClick={run}
                className="min-h-[3.2rem] text-base font-semibold text-foreground"
              >
                {label}
              </MarginRow>
            ))}
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
