import type { System } from "./systems.types";
import type { Task } from "@/features/tasks/tasks.types";
import { SYSTEM_TYPE_CONFIG, type SystemType } from "@/shared/lib/system-types";

export type SystemStatus = "active" | "stale";

/**
 * Señales legibles de un sistema (PLAN-07 §2.3). No es un score 0–100: es un
 * set de hechos accionables. La única que dispara highlight/advisor es `stale`.
 */
export interface SystemSignals {
  status: SystemStatus;
  stale: boolean;
  /** Días desde la última tarea completada; null si nunca se completó ninguna. */
  daysSinceLastActivity: number | null;
  activeTaskCount: number;
  /** dueDate (ISO) más próximo entre las tareas activas; null si ninguna. */
  nextDueDate: string | null;
}

const DAY_MS = 86_400_000;

/** Umbral de inactividad (días) tolerado según la frecuencia esperada. */
export function staleThresholdDays(frequency: string | null | undefined): number {
  switch (frequency) {
    case "daily":
      return 2;
    case "monthly":
      return 35;
    case "weekly":
    default:
      return 9;
  }
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

const isActiveTask = (t: Task) =>
  !t.deletedAt && t.status !== "done" && t.status !== "archived";

/**
 * Deriva `stale` desde primitivas. stale = el sistema tiene trabajo pendiente
 * (≥1 tarea activa) y no registra una tarea completada dentro de la ventana que
 * tolera su `expectedFrequency`. Un sistema sin tareas activas nunca es stale
 * (no se molesta a un sistema vacío). Si nunca se completó una tarea, se evalúa
 * contra la antigüedad del sistema para no marcar como stale uno recién creado.
 */
export function deriveStale(params: {
  expectedFrequency: string | null | undefined;
  activeTaskCount: number;
  daysSinceLastActivity: number | null;
  daysSinceCreated: number;
}): boolean {
  const { expectedFrequency, activeTaskCount, daysSinceLastActivity, daysSinceCreated } = params;
  if (activeTaskCount === 0) return false;
  const reference = daysSinceLastActivity ?? daysSinceCreated;
  return reference > staleThresholdDays(expectedFrequency);
}

/** Calcula todas las señales de un sistema desde su lista completa de tareas. */
export function computeSystemSignals(
  system: System,
  tasks: Task[],
  now = new Date(),
): SystemSignals {
  const activeTasks = tasks.filter(isActiveTask);

  let lastCompletedAt: Date | null = null;
  for (const t of tasks) {
    if (!t.completedAt || t.deletedAt) continue;
    const d = new Date(t.completedAt);
    if (!lastCompletedAt || d > lastCompletedAt) lastCompletedAt = d;
  }

  let nextDue: Date | null = null;
  for (const t of activeTasks) {
    if (!t.dueDate) continue;
    const d = new Date(t.dueDate);
    if (!nextDue || d < nextDue) nextDue = d;
  }

  const daysSinceLastActivity = lastCompletedAt ? daysBetween(lastCompletedAt, now) : null;
  const daysSinceCreated = system.createdAt ? daysBetween(new Date(system.createdAt), now) : 0;

  const stale = deriveStale({
    expectedFrequency: system.expectedFrequency,
    activeTaskCount: activeTasks.length,
    daysSinceLastActivity,
    daysSinceCreated,
  });

  return {
    status: stale ? "stale" : "active",
    stale,
    daysSinceLastActivity,
    activeTaskCount: activeTasks.length,
    nextDueDate: nextDue ? nextDue.toISOString() : null,
  };
}

/**
 * Mensaje del advisor cuando un sistema está stale, interpolando el
 * `staleTemplate` del preset ({nombre}, {n}). null si el sistema no está stale.
 */
export function formatStaleAdvisor(
  system: Pick<System, "templateType" | "name">,
  signals: SystemSignals,
): string | null {
  if (!signals.stale) return null;
  const config = SYSTEM_TYPE_CONFIG[(system.templateType ?? "custom") as SystemType];
  const n = signals.daysSinceLastActivity ?? 0;
  return config.staleTemplate.replace("{nombre}", system.name).replace("{n}", String(n));
}
