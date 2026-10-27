import { addDays, format, startOfWeek } from "date-fns";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import { parseDueDate, dueDateHasTime, parseTaskDay } from "@/features/tasks/tasks.utils";

/**
 * Cálculo puro de la rejilla del calendario (KIN-146, FE-05).
 *
 * Extraído de `GlobalCalendarView` sin cambiar comportamiento: aquí vive la
 * geometría: dónde cae un bloque, cuánto mide, en qué día entra cada tarea:
 * que antes estaba entrelazada con la vista y por tanto no se podía testear.
 * Nada de este archivo toca React.
 */

export const ROW_HEIGHT = 56; // px por hora
export const START_HOUR = 6;
export const END_HOUR = 22;
export const HOURS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => START_HOUR + i,
);
export const TOTAL_HEIGHT = HOURS.length * ROW_HEIGHT;

/** Alto mínimo de un bloque, para que una tarea de 15 min siga siendo legible. */
const MIN_BLOCK_HEIGHT = 24;
/** La duración se ajusta a cuartos de hora al redimensionar. */
const RESIZE_SNAP_MINUTES = 15;

export function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function parseEstimatedMinutes(time: string | null | undefined): number {
  if (!time) return 60;
  const parts = time.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Nivel de energía de 0 a 100, a la clase de fondo del overlay. */
export function energyBgClass(capacity: number): string {
  if (capacity >= 60) return "bg-task-done/8";
  if (capacity >= 30) return "bg-primary/8";
  return "bg-task-overdue/8";
}

/**
 * Mejor hora libre para el `energyLevel` de una tarea según la curva proyectada:
 * `high` busca el pico, `low` el valle, `medium` lo más cercano al 50%.
 */
export function suggestHour(
  energyLevel: string,
  curve: number[],
  occupiedHours: Set<number>,
): number | null {
  let bestHour: number | null = null;
  let bestScore = -Infinity;
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    if (occupiedHours.has(h)) continue;
    const cap = curve[h] ?? 0;
    const score =
      energyLevel === "high" ? cap
      : energyLevel === "low" ? -cap
      : -(Math.abs(cap - 50)); // medium → lo más cerca del 50%
    if (score > bestScore) { bestScore = score; bestHour = h; }
  }
  return bestHour;
}

/** Fecha de colocación preferida: startDate con hora > dueDate > startDate sin hora. */
export function getPlacementDate(task: TaskTransport): string | null {
  if (task.startDate && dueDateHasTime(task.startDate)) return task.startDate;
  if (task.dueDate) return task.dueDate;
  return task.startDate ?? null;
}

/** Posición y alto absolutos de un bloque dentro de la columna del día. */
export function blockGeometry(
  date: Date,
  estimatedMinutes: number,
): { top: number; height: number } {
  const top = (date.getHours() - START_HOUR + date.getMinutes() / 60) * ROW_HEIGHT;
  const height = Math.max(MIN_BLOCK_HEIGHT, (estimatedMinutes / 60) * ROW_HEIGHT);
  return { top, height };
}

/** Posición vertical del slot de una hora dentro de la columna. */
export function slotTop(hour: number): number {
  return (hour - START_HOUR) * ROW_HEIGHT;
}

/**
 * Duración resultante de arrastrar el tirador de resize `deltaY` píxeles.
 * Se ajusta a cuartos de hora y nunca baja de uno.
 */
export function resizedMinutes(startMinutes: number, deltaY: number): number {
  const deltaMinutes =
    Math.round((deltaY / ROW_HEIGHT) * 60 / RESIZE_SNAP_MINUTES) * RESIZE_SNAP_MINUTES;
  return Math.max(RESIZE_SNAP_MINUTES, startMinutes + deltaMinutes);
}

/**
 * Reparte tareas por día. `timed: true` devuelve las que tienen hora, ubicadas
 * por su instante exacto; `timed: false` las de todo el día, ubicadas por su
 * día calendario: son dos parseos distintos a propósito, por el off-by-one de
 * timezone que arrastran las fechas sin hora.
 */
export function groupTasksByDay(tasks: TaskTransport[], options: { timed: boolean }): Map<string, TaskTransport[]> {
  const map = new Map<string, TaskTransport[]>();
  for (const task of tasks) {
    const dateVal = getPlacementDate(task);
    if (!dateVal) continue;
    if (dueDateHasTime(dateVal) !== options.timed) continue;
    const key = dayKey(options.timed ? parseDueDate(dateVal) : parseTaskDay(dateVal));
    const bucket = map.get(key);
    if (bucket) bucket.push(task);
    else map.set(key, [task]);
  }
  return map;
}

/** Horas ya ocupadas de un día, para que una sugerencia no caiga encima. */
export function occupiedHoursForDay(tasks: TaskTransport[], day: Date): Set<number> {
  const set = new Set<number>();
  const key = dayKey(day);
  for (const task of tasks) {
    const dateVal = getPlacementDate(task);
    if (!dateVal || !dueDateHasTime(dateVal)) continue;
    const date = parseDueDate(dateVal);
    if (dayKey(date) === key) set.add(date.getHours());
  }
  return set;
}

/** "09:30" de la hora en que se coloca una tarea con hora. */
export function placementTime(task: TaskTransport): string | null {
  const dateVal = getPlacementDate(task);
  if (!dateVal || !dueDateHasTime(dateVal)) return null;
  return format(parseDueDate(dateVal), "HH:mm");
}

/**
 * Las tareas con hora de un día, en el orden en que pasan. Recibe el mapa por
 * día de `groupTasksByDay({ timed: true })`, el mismo que lee la rejilla de
 * escritorio, así que el teléfono y el escritorio no pueden discrepar en qué
 * tarea cae en qué día. No recorta por la rejilla de 06:00 a 22:00: una tarea
 * a las 23:15 también es del día.
 */
export function timedTasksOfDay(timedByDay: Map<string, TaskTransport[]>, day: Date): TaskTransport[] {
  const tasks = timedByDay.get(dayKey(day)) ?? [];
  const instant = (task: TaskTransport) => parseDueDate(getPlacementDate(task) ?? "").getTime();
  return [...tasks].sort((a, b) => instant(a) - instant(b));
}

/** Los siete días de la semana (lunes a domingo) que contiene `day`. */
export function weekOf(day: Date): Date[] {
  const start = startOfWeek(day, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * Cuánto lleva cada día, de 0 a 3 puntos: la tira de la semana dibuja un punto
 * por cada tarea hasta tres, y tres quiere decir "tres o más". Cuenta las dos
 * clases (con hora y de todo el día) porque las dos ocupan el día.
 */
export function dayLoad(
  byDayAllDay: Map<string, TaskTransport[]>,
  timedByDay: Map<string, TaskTransport[]>,
  day: Date,
): number {
  const key = dayKey(day);
  const total = (byDayAllDay.get(key)?.length ?? 0) + (timedByDay.get(key)?.length ?? 0);
  return Math.min(3, total);
}
