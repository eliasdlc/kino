/**
 * Parsea un dueDate a Date.
 *
 * Existe por el formato, no por el tipo. `dueDate` y `startDate` son las dos
 * únicas columnas de fecha con `mode: 'string'`, así que el driver las entrega
 * ya como texto y pueden venir en tres formas: ISO
 * ("2026-06-09T09:00:00.000Z"), formato Postgres con espacio
 * ("2026-06-09 09:00:00+00") o sólo el día ("2026-06-09"). El constructor Date
 * maneja las tres; `parseISO` de date-fns NO acepta la del espacio.
 *
 * El resto de las fechas de una tarea no pasan por aquí: el tipo de transporte
 * dice que son texto ISO, y un `new Date(...)` sobre ellas es una conversión de
 * verdad, no la defensa que era cuando el tipo decía `Date` y llegaba texto.
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

/**
 * true si el dueDate tiene una hora significativa. Un "día pelado" puede venir
 * como medianoche LOCAL (lo que guarda dayToLocalISO) o medianoche UTC (datos
 * importados por MCP/seeds). Ambos casos son "sin hora"; cualquier otro instante
 * sí lleva hora. Reusa la misma heurística de medianoche-UTC que parseTaskDay
 * para no marcar hora espuria en tareas importadas (FE-06).
 */
export function dueDateHasTime(value: string): boolean {
  const d = parseDueDate(value);
  const localMidnight =
    d.getHours() === 0 &&
    d.getMinutes() === 0 &&
    d.getSeconds() === 0 &&
    d.getMilliseconds() === 0;
  const utcMidnight =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;
  return !localMidnight && !utcMidnight;
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
