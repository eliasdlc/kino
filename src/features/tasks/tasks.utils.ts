import { calendarDayInTz } from "@/shared/time";

/**
 * Scheduling statuses that are auto-derived from startDate.
 * "done" and "archived" are intentionally excluded — those are
 * explicit user actions that should never be overwritten by date logic.
 */
export type ScheduleStatus = "backlog" | "today" | "tomorrow" | "week";

/**
 * Derives the scheduling status from a task's startDate.
 *
 * Why hybrid (stored + derived)?
 *   - Storing the status allows fast indexed queries (no runtime computation).
 *   - Deriving on write keeps status in sync with date changes.
 *   - A daily reconciliation job catches stale statuses (e.g. yesterday's "today").
 *
 * `timezone` define qué cuenta como "hoy"/"mañana": comparar el día calendario
 * del usuario, no el reloj UTC del server (Vercel) — si no, crear una tarea
 * "para hoy" después de las 20:00 hora local la derivaba a `week`.
 */
export function deriveStatusFromDate(
  startDate: string | null | undefined,
  timezone: string = "UTC",
): ScheduleStatus {
  if (!startDate) return "backlog";

  // startDate puede llegar como día lógico ("yyyy-MM-dd") o como ISO con hora
  // (timestamptz). Para el día pelado lo usamos tal cual; para un instante,
  // calculamos su día calendario en la tz del usuario.
  const day = startDate.length <= 10
    ? startDate.slice(0, 10)
    : calendarDayInTz(new Date(startDate), timezone);
  const now = new Date();
  const today = calendarDayInTz(now, timezone);
  const tomorrow = calendarDayInTz(new Date(now.getTime() + 86_400_000), timezone);

  if (day === today) return "today";
  if (day === tomorrow) return "tomorrow";
  return "week";
}

/**
 * Parsea un dueDate a Date. dueDate es timestamptz (PLAN-07 fase 3): puede
 * llegar como ISO ("2026-06-09T09:00:00.000Z"), formato Postgres con espacio
 * ("2026-06-09 09:00:00+00") o solo fecha ("2026-06-09"). El constructor Date
 * maneja los tres; parseISO de date-fns NO acepta el formato con espacio.
 */
export function parseDueDate(value: string): Date {
  return new Date(value);
}

/**
 * Día calendario (Date a medianoche LOCAL) de un start/dueDate, para ubicar la
 * tarea en un grid de días.
 *
 * start/dueDate son timestamptz. La app guarda el día pelado como medianoche
 * LOCAL (ver dayToLocalISO), pero datos importados (MCP, seeds) pueden venir como
 * medianoche UTC. Convertir esos a local en tz negativas los corre al día
 * anterior. Heurística: un instante exactamente a medianoche UTC representa ese
 * día UTC (día pelado, sin hora); cualquier otro instante usa su día local.
 */
export function parseTaskDay(value: string): Date {
  const d = parseDueDate(value);
  if (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  ) {
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  return d;
}

/** true si el dueDate tiene una hora significativa (no medianoche). */
export function dueDateHasTime(value: string): boolean {
  const d = parseDueDate(value);
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

/**
 * Convierte un día "yyyy-MM-dd" (+ hora "HH:mm" opcional) a un ISO en la
 * medianoche/hora LOCAL del navegador. startDate y dueDate son timestamptz:
 * enviar el día pelado los guarda a medianoche UTC y al releerlos en tz
 * negativas caen al día anterior. Construir el instante en hora local y
 * serializar con toISOString() round-trips correcto (display via parseDueDate).
 */
export function dayToLocalISO(day: string, time?: string | null): string {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  // time vacío/ausente → medianoche. (`||` cubre "" además de null/undefined.)
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0).toISOString();
}
