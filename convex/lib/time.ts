// Origen único de "hoy en la zona del usuario" dentro de Convex. Es la misma
// idea que `src/shared/time`, sin la mitad SQL, que aquí no existe.

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
