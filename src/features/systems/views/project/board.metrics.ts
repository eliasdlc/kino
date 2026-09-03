import type { TaskTransport } from "@/features/tasks/tasks.types";

/** A partir de cuántos días en una columna no-terminal una tarjeta se considera estancada. */
export const STALL_DAYS = 3;

/** Días (enteros) que la tarjeta lleva en su columna actual del board. null si nunca se movió. */
export function boardAgingDays(task: TaskTransport): number | null {
  if (!task.boardStatusChangedAt) return null;
  const changed = new Date(task.boardStatusChangedAt).getTime();
  const days = Math.floor((Date.now() - changed) / 86_400_000);
  return days > 0 ? days : 0;
}

/** ¿La tarjeta lleva demasiado tiempo sin avanzar en una columna no-terminal? */
export function isStalled(task: TaskTransport): boolean {
  const col = task.boardStatus ?? "todo";
  if (col === "done" || task.status === "done") return false;
  const aging = boardAgingDays(task);
  return aging !== null && aging >= STALL_DAYS;
}

export interface BoardMetrics {
  /** Tarjetas que no están en la columna terminal. */
  active: number;
  /** Tarjetas en la columna terminal (o completadas). */
  done: number;
  /** Tarjetas estancadas (aging ≥ STALL_DAYS en columna no-terminal). */
  stalled: number;
}

export function computeBoardMetrics(tasks: TaskTransport[]): BoardMetrics {
  let active = 0;
  let done = 0;
  let stalled = 0;
  for (const t of tasks) {
    const col = t.boardStatus ?? "todo";
    if (col === "done" || t.status === "done") {
      done++;
      continue;
    }
    active++;
    if (isStalled(t)) stalled++;
  }
  return { active, done, stalled };
}
