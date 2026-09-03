"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Plus, Flag, CheckCircle2, Trash2 } from "lucide-react";
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

function chipClass(active: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors",
    active
      ? "bg-primary/15 border-primary/30 text-foreground"
      : "bg-transparent border-border text-muted-foreground hover:border-muted-foreground/50",
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

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
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
      <button type="button" onClick={() => onSelectFilter(null)} className={chipClass(sprintFilter === null)}>
        Todas
      </button>

      {active.map((s) => {
        const { done, total } = progress(s.id);
        return (
          <button key={s.id} type="button" onClick={() => onSelectFilter(s.id)} className={chipClass(sprintFilter === s.id)}>
            <Flag size={12} className="text-primary" />
            {s.name}
            <span className="opacity-60 font-mono">{done}/{total}</span>
          </button>
        );
      })}

      <button type="button" onClick={() => onSelectFilter("none")} className={chipClass(sprintFilter === "none")}>
        Sin sprint
      </button>

      {adding ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setAdding(false);
          }}
          onBlur={() => {
            if (!name.trim()) setAdding(false);
          }}
          placeholder="Nombre del sprint"
          className="text-xs bg-muted rounded-md px-2 py-1 border outline-none focus:ring-1 focus:ring-primary/40"
        />
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setAdding(true)} disabled={creating} className="h-7 text-xs gap-1">
          <Plus size={12} /> SprintTransport
        </Button>
      )}

      {selectedActive && (
        <div className="flex items-center gap-1 ml-auto">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => setCloseTarget(selectedActive)}
          >
            <CheckCircle2 size={12} /> Cerrar sprint
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteTarget(selectedActive)}
            aria-label="Eliminar sprint"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={closeTarget !== null}
        title="Cerrar sprint"
        description={`"${closeTarget?.name}" se marcará como completado y se moverá a Archivadas con sus tarjetas.`}
        confirmLabel="Cerrar sprint"
        onConfirm={() => {
          if (closeTarget) closeSprint(closeTarget.id);
          if (closeTarget && sprintFilter === closeTarget.id) onSelectFilter(null);
          setCloseTarget(null);
        }}
        onCancel={() => setCloseTarget(null)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar sprint"
        description={`"${deleteTarget?.name}" se eliminará. Sus tarjetas no se borran: quedan sin sprint asignado.`}
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
