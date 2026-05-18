import { isToday, isTomorrow, parseISO } from "date-fns";

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
 */
export function deriveStatusFromDate(startDate: string | null | undefined): ScheduleStatus {
  if (!startDate) return "backlog";

  // parseISO handles "yyyy-MM-dd" strings, interpreted as local midnight
  const date = parseISO(startDate);

  if (isToday(date)) return "today";
  if (isTomorrow(date)) return "tomorrow";
  return "week";
}
