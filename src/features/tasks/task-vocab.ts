import { differenceInCalendarDays, startOfToday } from "date-fns";
import { parseDueDate } from "./tasks.utils";

/**
 * Un solo vocabulario para la prioridad, la energía y la fecha de una tarea.
 * Antes cada fila decía lo mismo a su manera: "Energía alta" en una etiqueta,
 * "alta" en otra, `high` crudo en una tercera, la fecha en inglés (`MMM d`) en
 * las cards y en español en las filas, y Crítica y Alta con el mismo coral.
 *
 * La regla: en un campo (el detalle, un filtro, una columna) la palabra va
 * sola y en mayúscula, porque el rótulo ya dice de qué es ("Energía: Alta").
 * En la meta de una fila, donde no hay rótulo, va en minúscula y con su
 * nombre ("energía alta"), salvo la prioridad, que sólo se dice cuando pesa
 * (crítica, alta) y entonces va en negrita, no en color. Crítica y alta son
 * palabras distintas con pesos distintos; ninguna es coral, que es de vencida.
 */

export const PRIORITY_WORD: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export const ENERGY_WORD: Record<string, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

/** La prioridad en la meta de una fila: sólo crítica y alta se dicen. */
export function priorityMeta(priority: string | null | undefined): string | null {
  if (priority === "critical") return "crítica";
  if (priority === "high") return "alta";
  return null;
}

/** La energía en la meta de una fila: "energía alta". */
export function energyMeta(energy: string | null | undefined): string {
  return `energía ${(ENERGY_WORD[energy ?? "medium"] ?? "Media").toLowerCase()}`;
}

/** "1 sept", "18 oct": la fecha corta en español, sin el punto de la abreviatura. */
export function shortDate(iso: string): string {
  return parseDueDate(iso).toLocaleDateString("es", { day: "numeric", month: "short" }).replace(".", "");
}

export interface DueMeta {
  /** "vencida", "vence" o null cuando la tarea no tiene fecha. */
  word: "vencida" | "vence" | null;
  /** "hoy", "mañana" o la fecha corta. */
  when: string;
  overdue: boolean;
}

/** La fecha límite como meta: la palabra delante y el cuándo después. */
export function dueMeta(dueDate: string | null | undefined, done = false): DueMeta {
  if (!dueDate) return { word: null, when: "", overdue: false };
  const days = differenceInCalendarDays(parseDueDate(dueDate), startOfToday());
  const overdue = days < 0 && !done;
  const when = days === 0 ? "hoy" : days === 1 ? "mañana" : shortDate(dueDate);
  return { word: overdue ? "vencida" : "vence", when, overdue };
}

/** "2:30" para 02:30:00, "0:45" para 00:45; vacío si no hay estimación. */
export function estimatedLabel(t: string | null | undefined): string {
  if (!t) return "";
  const [h = "0", m = "0"] = t.split(":");
  if (Number.isNaN(parseInt(h, 10))) return "";
  return `${parseInt(h, 10)}:${m.padStart(2, "0")}`;
}

/** Minutos de una estimación "HH:MM", o null. */
export function estimatedMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h = "0", m = "0"] = t.split(":");
  const total = parseInt(h, 10) * 60 + parseInt(m, 10);
  return Number.isFinite(total) && total > 0 ? total : null;
}
