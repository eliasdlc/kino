// Origen único de la hora de la cuenta: "hoy en la zona del usuario", el reloj
// de esa zona y el instante UTC de una hora local. Lo usan las funciones de
// Convex y, por `src/shared/time`, el cliente. Prohibido reimplementarlo fuera:
// las copias que hubo divergían, y dos tenían el desfase de un día de las zonas
// negativas.

/** Día calendario (yyyy-MM-dd) de un instante en la zona dada. */
export function calendarDayInTz(instant: number | Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Hoy (yyyy-MM-dd) en la zona del usuario. */
export function userToday(tz: string, now = Date.now()): string {
  return calendarDayInTz(now, tz);
}

/** Mañana (yyyy-MM-dd) en la zona del usuario. */
export function userTomorrow(tz: string, now = Date.now()): string {
  return calendarDayInTz(now + 86_400_000, tz);
}

/**
 * Offset (ms) tal que `wallClockComoUTC - instanteReal` para `date` en `tz`.
 * Positivo al este de UTC, negativo al oeste. Base para convertir una hora
 * local a su instante UTC real.
 */
function tzOffsetMs(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  // hour puede venir como "24" a medianoche en algunas implementaciones de Intl.
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return asUtc - date.getTime();
}

/**
 * Instante UTC de un reloj local (`minutes` desde la medianoche) del día
 * `yyyy-MM-dd` en `tz`. El servidor corre en UTC, así que construir la hora con
 * `new Date(y, m, d, h)` daría el día equivocado: los recordatorios dicen "las
 * 21:30" y tienen que caer a las 21:30 **del usuario**.
 */
export function zonedDayClockToUtc(dayISO: string, minutes: number, tz: string): Date {
  const [y, m, d] = dayISO.slice(0, 10).split('-').map(Number);
  const total = Math.max(0, Math.min(24 * 60 - 1, Math.floor(minutes)));
  const guess = Date.UTC(y!, (m ?? 1) - 1, d ?? 1, Math.floor(total / 60), total % 60, 0);
  const offset = tzOffsetMs(new Date(guess), tz);
  return new Date(guess - offset);
}

/** Hora del reloj de la cuenta, independiente de la zona del servidor o navegador. */
export function hourInTimeZone(timezone: string, now: number): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hourCycle: 'h23' }).format(now));
}

/** Minutos desde la medianoche local de `instant` en `tz` (0 a 1439). */
export function minutesInTimeZone(timezone: string, instant: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return (get('hour') % 24) * 60 + get('minute');
}
