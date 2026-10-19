"use client";

import { differenceInCalendarDays } from "date-fns";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseDueDate } from "@/features/tasks/tasks.utils";
import { getTaskTypeConfig } from "@/features/tasks/task-type-config";
import type { LinkedTaskTransport } from "./pages.types";

/** Dónde está la tarea, en palabras. */
export const ESTADO_TAREA: Record<string, string> = {
  backlog: "en espera",
  week: "esta semana",
  tomorrow: "mañana",
  today: "hoy",
  done: "hecha",
  archived: "archivada",
};

interface LinkedTaskCardProps {
  task: LinkedTaskTransport;
  onToggle: () => void;
  onEdit: () => void;
  onUnlink: () => void;
}

/** Los meses como los escribe la casa: «8 sept», sin punto. */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/** La fecha de entrega dicha con su estado delante, y si toca, en coral. */
/**
 * La estimación llega como reloj («00:25:00», «1:30»): se lee en minutos u
 * horas, nunca el reloj crudo seguido de «min».
 */
export function duracionEstimada(reloj: string | null | undefined): string | null {
  if (!reloj) return null;
  const [h = "0", m = "0"] = reloj.split(":");
  const total = (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
  if (total <= 0) return null;
  if (total < 60) return `${total} min`;
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

export function fechaDeEntrega(dueDate: string, hoy = new Date()): { texto: string; vencida: boolean } {
  const fecha = parseDueDate(dueDate);
  const dias = differenceInCalendarDays(fecha, hoy);
  const dia = `${fecha.getDate()} ${MESES[fecha.getMonth()]}`;
  if (dias < 0) return { texto: `vencida ${dia}`, vencida: true };
  if (dias === 0) return { texto: "vence hoy", vencida: false };
  if (dias === 1) return { texto: "vence mañana", vencida: false };
  return { texto: `vence ${dia}`, vencida: false };
}

/**
 * Una tarea enlazada a la página, como fila de Diario: el círculo de completar
 * en el margen (48 px de toque), el título que abre su ficha, y debajo la meta
 * separada por comas: tipo, dónde está, prioridad alta en peso y la fecha. El
 * coral sólo acompaña a «vencida»; hecha es `--ok` con su check.
 *
 * Desvincular es visible en un dedo; en escritorio aparece al pasar el puntero
 * o con el foco, para no repetir una X en cada fila.
 */
export function LinkedTaskCard({ task, onToggle, onEdit, onUnlink }: LinkedTaskCardProps) {
  const isDone = task.status === "done";
  const typeConfig = getTaskTypeConfig(task.taskType ?? undefined);
  const entrega = task.dueDate ? fechaDeEntrega(task.dueDate) : null;
  const duracion = duracionEstimada(task.estimatedTime);
  const prioridadAlta = task.priority === "critical" || task.priority === "high";

  return (
    <div
      data-slot="linked-task"
      className="group grid min-h-[3.4rem] grid-cols-[var(--margen)_1fr_auto] items-center border-b border-border last:border-b-0"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={isDone}
        aria-label={isDone ? `Marcar «${task.title}» como pendiente` : `Completar «${task.title}»`}
        className="press flex size-[2.85rem] items-center justify-center justify-self-center rounded-full transition-transform duration-(--dur-toque) ease-(--ease-pluma) focus-ring"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-6 items-center justify-center rounded-full border-2 transition-colors duration-(--dur-tachar) ease-(--ease-pluma)",
            isDone ? "border-ok bg-ok text-background" : "border-ln2 group-hover:border-muted-foreground",
          )}
        >
          {isDone && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      </button>

      <button type="button" onClick={onEdit} className="min-w-0 rounded-md py-2 text-left focus-ring">
        <span
          className={cn(
            "block truncate text-base font-semibold transition-colors duration-(--dur-tachar) ease-(--ease-pluma)",
            isDone ? "text-muted-foreground line-through" : "text-foreground",
          )}
        >
          {task.title}
        </span>
        <span className="block truncate text-sm text-muted-foreground">
          {[
            task.taskType ? typeConfig.label.toLowerCase() : null,
            isDone ? null : (ESTADO_TAREA[task.status] ?? null),
          ]
            .filter(Boolean)
            .join(", ")}
          {prioridadAlta && (
            <>
              {", "}
              <span className="font-semibold text-foreground">{task.priority === "critical" ? "crítica" : "alta"}</span>
            </>
          )}
          {entrega && !isDone && (
            <>
              {", "}
              <span className={cn(entrega.vencida && "text-warn")}>{entrega.texto}</span>
            </>
          )}
          {duracion ? `, ${duracion}` : null}
        </span>
      </button>

      <button
        type="button"
        onClick={onUnlink}
        aria-label={`Desvincular «${task.title}»`}
        title="Desvincular de esta página"
        className="press flex size-[2.85rem] items-center justify-center rounded-full text-muted-foreground transition-[color,opacity,transform] duration-(--dur-toque) ease-(--ease-pluma) focus-ring hover:text-destructive md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
