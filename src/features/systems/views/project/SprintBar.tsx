"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Plus, Flag, CheckCircle2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateSprint, useCloseSprint, useDeleteSprint } from "@/features/sprints/sprints.hooks";
import type { SprintTransport } from "@/features/sprints/sprints.types";
import type { TaskTransport } from "@/features/tasks/tasks.types";

interface SprintBarProps {
  systemId: string;
  sprints: SprintTransport[];
  tasks: TaskTransport[];
  sprintFilter: string | null;
  onSelectFilter: (value: string | null) => void;
}

/**
 * Un filtro elegido es un estado, no una acción: va en tinta, como el
 * segmento. El ámbar se queda para crear. 2.85rem en el teléfono, y el chip
 * compacto sólo con ratón.
 */
function chipClass(active: boolean) {
  return cn(
    "press inline-flex h-[2.85rem] items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-[color,background-color,border-color,transform] duration-(--dur-toque) ease-(--ease-pluma) focus-ring md:pointer-fine:h-8 md:pointer-fine:px-3 md:pointer-fine:text-xs",
    active
      ? "border-foreground bg-foreground text-background"
      : "border-border bg-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground",
  );
}

export function SprintBar({ systemId, sprints, tasks, sprintFilter, onSelectFilter }: SprintBarProps) {
  const { mutate: createSprint, isPending: creating } = useCreateSprint(systemId);
  const { mutate: closeSprint } = useCloseSprint(systemId);
  const { mutate: deleteSprint } = useDeleteSprint(systemId);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [closeTarget, setCloseTarget] = useState<SprintTransport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SprintTransport | null>(null);

  const active = sprints.filter((s) => s.status === "active");
  const selectedActive = active.find((s) => s.id === sprintFilter) ?? null;

  function cancelar() {
    setName("");
    setAdding(false);
  }

  function submit() {
    const trimmed = name.trim();
    // Enter y salir del campo pueden llegar los dos: un solo ciclo.
    if (!trimmed || creating) return;
    createSprint(
      { name: trimmed },
      {
        onSuccess: () => {
          setName("");
          setAdding(false);
        },
      },
    );
  }

  function progress(sprintId: string) {
    const t = tasks.filter((x) => x.sprintId === sprintId && !x.deletedAt);
    return { done: t.filter((x) => x.status === "done").length, total: t.length };
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button type="button" aria-pressed={sprintFilter === null} onClick={() => onSelectFilter(null)} className={chipClass(sprintFilter === null)}>
        Todas
      </button>

      {active.map((s) => {
        const { done, total } = progress(s.id);
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={sprintFilter === s.id}
            onClick={() => onSelectFilter(s.id)}
            className={chipClass(sprintFilter === s.id)}
          >
            <Flag aria-hidden className="size-3.5" />
            {s.name}
            <span className={cn("tabular-nums", sprintFilter === s.id ? "opacity-70" : "text-mute")}>
              {done}/{total}
            </span>
          </button>
        );
      })}

      <button type="button" aria-pressed={sprintFilter === "none"} onClick={() => onSelectFilter("none")} className={chipClass(sprintFilter === "none")}>
        Sin ciclo
      </button>

      {adding ? (
        // En el teléfono no hay Escape: salir del campo crea el ciclo si tiene
        // nombre, y la X lo descarta. La X no le quita el foco al campo antes
        // de su toque, para que salir no cree lo que se quería descartar.
        <span className="inline-flex items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") cancelar();
            }}
            onBlur={() => {
              if (name.trim()) submit();
              else setAdding(false);
            }}
            enterKeyHint="done"
            placeholder="Nombre del ciclo"
            aria-label="Nombre del ciclo"
            className="h-[2.85rem] rounded-full border bg-muted px-3.5 text-base outline-none focus-ring md:pointer-fine:h-8 md:pointer-fine:text-xs"
          />
          <Button
            size="icon"
            variant="ghost"
            aria-label="Descartar el ciclo nuevo"
            onPointerDown={(e) => e.preventDefault()}
            onClick={cancelar}
            className="text-muted-foreground md:pointer-fine:size-8"
          >
            <X aria-hidden className="size-4" />
          </Button>
        </span>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setAdding(true)} disabled={creating} className="md:pointer-fine:h-8 md:pointer-fine:text-xs">
          <Plus aria-hidden className="size-4" /> Nuevo ciclo
        </Button>
      )}

      {selectedActive && (
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="md:pointer-fine:h-8 md:pointer-fine:text-xs"
            onClick={() => setCloseTarget(selectedActive)}
          >
            <CheckCircle2 aria-hidden className="size-4" /> Cerrar ciclo
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteTarget(selectedActive)}
            aria-label="Eliminar ciclo"
          >
            <Trash2 aria-hidden className="size-4" />
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={closeTarget !== null}
        title="Cerrar ciclo"
        description={`"${closeTarget?.name}" se marcará como completado y se moverá a Archivadas con sus tarjetas.`}
        confirmLabel="Cerrar ciclo"
        onConfirm={() => {
          if (closeTarget) closeSprint(closeTarget.id);
          if (closeTarget && sprintFilter === closeTarget.id) onSelectFilter(null);
          setCloseTarget(null);
        }}
        onCancel={() => setCloseTarget(null)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar ciclo"
        description={`"${deleteTarget?.name}" se eliminará. Sus tarjetas no se borran: quedan sin ciclo asignado.`}
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deleteTarget) deleteSprint(deleteTarget.id);
          if (deleteTarget && sprintFilter === deleteTarget.id) onSelectFilter(null);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
