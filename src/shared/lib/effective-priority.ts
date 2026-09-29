/**
 * La prioridad que cuenta, que no siempre es la que se eligió.
 *
 * Una tarea tiene dos ejes. La **importancia** la decide la persona al crearla
 * (`priority` en la base, y nace en alta). La **urgencia** la decide el
 * calendario: a medida que se acerca la fecha, la tarea exige más, elija lo que
 * se eligiera. Lo que se pinta, se filtra y se avisa es la mayor de las dos.
 *
 * Se calcula y no se escribe, a propósito:
 *   - mover la fecha hacia adelante la baja sola, y la elección original no se
 *     pierde en el camino;
 *   - no hace falta un cron que reescriba tareas cada día contra el plan
 *     gratuito;
 *   - el asesor de «prioridades planas» sigue mirando sólo lo elegido, y no se
 *     pelea con el calendario.
 *
 * La calcula el servidor (`taskItem`) y el cliente la recibe hecha.
 */

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export const PRIORITY_RANK: Record<Priority, number> = { low: 0, medium: 1, high: 2, critical: 3 };

const DAY_MS = 86_400_000;

/**
 * El suelo que pone el calendario, por lo que falta hasta la fecha:
 *
 *   | Falta              | Como mínimo |
 *   | más de 7 días      | lo elegido  |
 *   | 7 días o menos     | media       |
 *   | 3 días o menos     | alta        |
 *   | 1 día, o vencida   | crítica     |
 *
 * «1 día» cubre mañana, hoy y lo ya vencido.
 */
export function urgencyFloor(dueDate: number | undefined, now: number): Priority | null {
  if (dueDate === undefined) return null;
  const remaining = dueDate - now;
  if (remaining <= DAY_MS) return 'critical';
  if (remaining <= 3 * DAY_MS) return 'high';
  if (remaining <= 7 * DAY_MS) return 'medium';
  return null;
}

export interface EffectivePriority {
  /** La que cuenta: la mayor entre lo elegido y lo que exige la fecha. */
  priority: Priority;
  /** `true` cuando la fecha la subió por encima de lo elegido. */
  raised: boolean;
}

/**
 * Una tarea terminada no tiene urgencia: vuelve a lo que se eligió.
 */
export function effectivePriority(
  base: Priority,
  dueDate: number | undefined,
  now: number,
  done = false,
): EffectivePriority {
  const floor = done ? null : urgencyFloor(dueDate, now);
  if (floor === null || PRIORITY_RANK[floor] <= PRIORITY_RANK[base]) return { priority: base, raised: false };
  return { priority: floor, raised: true };
}
