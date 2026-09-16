"use client";

import { useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  FolderOpen,
  History,
  Layers,
  Sparkles,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { api } from "@convex/_generated/api";
import { cn } from "@/lib/utils";
import { getConvexClient } from "@/shared/convex/client";
import { useConvexQuery } from "@/shared/convex/hooks";
import { SuggestionList, type SuggestionEmptyState } from "@/shared/suggestions/SuggestionList";
import { TaskDetailSheet } from "@/features/tasks/TaskDetailSheet";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import type { FactKind, SystemFact } from "./brain";

/**
 * El mini cerebro del sistema: un párrafo de estado con su fecha y hasta seis
 * hechos, cada uno con la fila que lo respalda.
 *
 * Nace colapsado y se queda como lo dejes. Eso no es sólo una preferencia de
 * pantalla: mientras está cerrado no se suscribe, así que un sistema que se
 * abre para ver las tareas no paga las cinco lecturas del cerebro. La
 * preferencia es una sola para todos los sistemas, igual que la de la cabecera
 * que lo contiene.
 */

const ICON: Record<FactKind, LucideIcon> = {
  overdue: AlertTriangle,
  pileup: Layers,
  stalled: Clock,
  "next-due": CalendarClock,
  "empty-container": FolderOpen,
  "last-move": History,
  "last-closed": CheckCircle2,
  "observed-time": Timer,
};

/** Un sistema del que no hay una sola fila que citar. No está en calma, está sin empezar. */
const SIN_EMPEZAR: SuggestionEmptyState = {
  icon: Sparkles,
  title: "Todavía no hay nada que contar",
  description: "En cuanto este sistema tenga una tarea o una sesión, aquí aparece lo que pasa dentro.",
};

/** Hay datos y ninguna regla llegó a su umbral. Es lo contrario de lo de arriba. */
const NADA_QUE_SENALAR: SuggestionEmptyState = {
  icon: CheckCircle2,
  title: "Nada que señalar",
  description: "Nada pasado de fecha, nada acumulado y nada parado. Este sistema va al día.",
};

const OPEN_KEY = "systemBrainOpen";
const listeners = new Set<() => void>();

function subscribeOpen(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
/** Colapsado mientras nadie diga lo contrario, y lo mismo en el servidor. */
function readOpen() {
  return localStorage.getItem(OPEN_KEY) === "true";
}
function writeOpen(value: boolean) {
  localStorage.setItem(OPEN_KEY, String(value));
  listeners.forEach((notify) => notify());
}

/** A dónde lleva un hecho. Una tarea no tiene ruta propia: se abre en su hoja. */
function factHref(fact: SystemFact, systemId: string): string | null {
  switch (fact.target.kind) {
    case "folder":
      return `/systems/${systemId}/folders/${fact.target.id}`;
    case "page":
      return `/systems/${systemId}/pages/${fact.target.id}`;
    case "task":
      return null;
  }
}

export function SystemBrainPanel({ systemId }: { systemId: string }) {
  const open = useSyncExternalStore(subscribeOpen, readOpen, () => false);
  const [task, setTask] = useState<TaskTransport | null>(null);
  const { data, isLoading } = useConvexQuery(api.systems.brain, open ? { id: systemId } : "skip");

  // La tarea llega entera sólo cuando alguien pulsa su hecho: el cerebro manda
  // el id y el título, que es lo que la fila necesita para decir lo que dice.
  async function openTask(fact: SystemFact) {
    if (fact.target.kind !== "task") return;
    setTask(await getConvexClient().query(api.tasks.byId, { id: fact.target.id }));
  }

  return (
    <div className="pl-6">
      <button
        type="button"
        onClick={() => writeOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
        <span className="font-medium">Cómo va esto</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {isLoading || !data ? (
            <BrainSkeleton />
          ) : (
            <>
              <p className="text-xs leading-relaxed text-muted-foreground">{data.paragraph}</p>
              <SuggestionList<SystemFact>
                suggestions={data.facts}
                unstarted={SIN_EMPEZAR}
                quiet={NADA_QUE_SENALAR}
                isUnstarted={data.unstarted}
                iconFor={(fact) => ICON[fact.kind]}
                hrefFor={(fact) => factHref(fact, systemId)}
                onSelect={openTask}
              />
            </>
          )}
        </div>
      )}

      {task && (
        <TaskDetailSheet
          task={task}
          systemId={systemId}
          open={task !== null}
          onOpenChange={(abierta) => {
            if (!abierta) setTask(null);
          }}
        />
      )}
    </div>
  );
}

/** Con la forma de lo que va a llegar: un párrafo y sus filas. */
function BrainSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <div className="h-3 w-3/4 rounded-md bg-muted" />
      <div className="h-14 w-full rounded-xl bg-muted" />
      <div className="h-14 w-full rounded-xl bg-muted" />
    </div>
  );
}
