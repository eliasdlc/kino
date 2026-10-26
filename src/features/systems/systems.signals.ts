import type { System } from "./systems.types";
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

/** Umbral de inactividad (días) tolerado según la frecuencia esperada. */
function staleThresholdDays(frequency: string | null | undefined): number {
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

/**
 * Mensaje del advisor cuando un sistema está stale, interpolando el
 * `staleTemplate` del preset ({nombre}, {n}). null si el sistema no está stale.
 */
export function formatStaleAdvisor(
  system: Pick<System, "templateType" | "name">,
  signals: SystemSignals,
): string | null {
  if (!signals.stale) return null;
  // Dormido sin ninguna tarea hecha nunca no son «0 días»: esa cuenta leía
  // como si la última hubiera sido hoy, justo al lado de la palabra dormido.
  if (signals.daysSinceLastActivity === null) return `Todavía no hay ninguna tarea hecha en ${system.name}.`;
  const config = SYSTEM_TYPE_CONFIG[(system.templateType ?? "custom") as SystemType];
  return config.staleTemplate
    .replace("{nombre}", system.name)
    .replace("{n}", String(signals.daysSinceLastActivity));
}
