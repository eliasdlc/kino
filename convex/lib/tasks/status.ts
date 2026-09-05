import { calendarDayInTz, userToday, userTomorrow } from '../time';

// El estado de planificación que se deriva de la fecha de inicio. `done` no
// sale de aquí: es una acción explícita que la fecha nunca pisa.
export type ScheduleStatus = 'backlog' | 'today' | 'tomorrow' | 'week';

/**
 * Estado de planificación según la fecha de inicio, comparando el día
 * calendario del usuario y no el reloj del servidor: crear una tarea "para
 * hoy" a las diez de la noche tiene que quedarse en hoy.
 */
export function deriveStatusFromDate(
  startDate: number | undefined,
  timezone: string,
  now = Date.now(),
): ScheduleStatus {
  if (startDate === undefined) return 'backlog';
  const day = calendarDayInTz(startDate, timezone);
  if (day === userToday(timezone, now)) return 'today';
  if (day === userTomorrow(timezone, now)) return 'tomorrow';
  return 'week';
}

/**
 * Si asignar `parentTaskId` como padre de `taskId` es inválido: "self" cuando
 * son la misma, "cycle" cuando `taskId` ya es ancestro del nuevo padre.
 */
export async function findParentViolation(
  taskId: string,
  parentTaskId: string,
  getParentOf: (id: string) => Promise<string | undefined>,
): Promise<'self' | 'cycle' | null> {
  if (parentTaskId === taskId) return 'self';
  const seen = new Set<string>([parentTaskId]);
  let cursor = await getParentOf(parentTaskId);
  while (cursor) {
    if (cursor === taskId) return 'cycle';
    if (seen.has(cursor)) break;
    seen.add(cursor);
    cursor = await getParentOf(cursor);
  }
  return null;
}
