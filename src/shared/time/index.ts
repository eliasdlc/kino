/**
 * Origen único de "hoy en la timezone del usuario".
 *
 * Antes existían 4+ implementaciones divergentes de esta idea (SQL crudo en el
 * presupuesto de energía, `Intl` en energy.service, `new Date().toISOString()`
 * en el scheduler). Dos ya tenían el off-by-one clásico de tz negativas. Este
 * módulo las colapsa: todo cálculo de día local pasa por aquí, en su sabor TS o
 * en su sabor SQL. Prohibido reimplementar "hoy en la tz del usuario" fuera.
 */
import { sql, type SQL } from "drizzle-orm";

/** Día calendario (yyyy-MM-dd) de `date` en la timezone dada. */
export function calendarDayInTz(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Día de hoy (yyyy-MM-dd) en la timezone del usuario. */
export function userToday(tz: string): string {
  return calendarDayInTz(new Date(), tz);
}

/**
 * Offset (ms) tal que `wallClockComoUTC - instanteReal` para `date` en `tz`.
 * Positivo al este de UTC, negativo al oeste. Base para convertir una
 * medianoche local a su instante UTC real.
 */
function tzOffsetMs(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  // hour puede venir como "24" a medianoche en algunas implementaciones de Intl.
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - date.getTime();
}

/**
 * Instante UTC de una hora local del día `yyyy-MM-dd` en `tz`.
 *
 * El equivalente de servidor a `dayToLocalISO` del cliente: ese construye el
 * instante en la tz del navegador, que en el server (UTC) sería el día
 * equivocado. Lo usa el time-blocking por MCP, donde el agente dice "las 9" y la
 * hora tiene que caer en las 9 **del usuario**.
 */
export function zonedDayHourToUtc(dayISO: string, hour: number, tz: string): Date {
  const [y, m, d] = dayISO.slice(0, 10).split("-").map(Number);
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  const guess = Date.UTC(y!, (m ?? 1) - 1, d ?? 1, h, 0, 0);
  const offset = tzOffsetMs(new Date(guess), tz);
  return new Date(guess - offset);
}

/** Instante UTC de la medianoche local del día `yyyy-MM-dd` en `tz`. */
function zonedMidnightToUtc(dayISO: string, tz: string): Date {
  return zonedDayHourToUtc(dayISO, 0, tz);
}

/**
 * Rango [start, end) del día de hoy en la tz del usuario, como instantes
 * timestamptz. `start` = medianoche local de hoy; `end` = medianoche local de
 * mañana (respeta cambios de offset entre ambas, ej. DST).
 */
export function userDayRange(tz: string): { start: Date; end: Date } {
  const today = userToday(tz);
  const start = zonedMidnightToUtc(today, tz);
  // Día siguiente: partir de start + 24h y recalcular su día local evita
  // aritmética de calendario a mano y respeta el borde de mes/año.
  const nextDay = calendarDayInTz(new Date(start.getTime() + 86_400_000), tz);
  const end = zonedMidnightToUtc(nextDay, tz);
  return { start, end };
}

/**
 * Fragmento SQL: instante timestamptz de la medianoche local de hoy en `tz`.
 * Correcto: `(NOW() AT TIME ZONE tz)::date::timestamp AT TIME ZONE tz`.
 * El `::timestamp` intermedio (no `::timestamptz`) es lo que evita el bug de
 * interpretar la fecha local como medianoche UTC.
 */
export function sqlUserDay(tz: string): SQL {
  return sql`((NOW() AT TIME ZONE ${tz})::date::timestamp AT TIME ZONE ${tz})`;
}

/** Fragmento SQL: fecha (DATE) de hoy en la tz del usuario. */
export function sqlUserToday(tz: string): SQL {
  return sql`(NOW() AT TIME ZONE ${tz})::date`;
}
