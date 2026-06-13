import { addDays, format } from "date-fns";

/**
 * Parser de fechas en lenguaje natural (español) para la captura rápida.
 * Detecta tokens tipo "hoy", "mañana", "pasado mañana", días de la semana
 * y horas ("a las 5", "5:30pm"), los quita del título y devuelve el día/hora
 * listos para el form (yyyy-MM-dd / HH:mm, en hora local del dispositivo).
 */
export interface ParsedQuickDate {
  /** Título sin los tokens de fecha (puede quedar vacío). */
  title: string;
  /** Día detectado, formato yyyy-MM-dd. */
  dueDate: string;
  /** Hora detectada, formato HH:mm (24h). */
  dueTime?: string;
}

const WEEKDAY_RE =
  /\b(?:el\s+)?(lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)\b/i;

const WEEKDAY_INDEX: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

// "a las 5", "a la 1:30", con am/pm opcional.
const TIME_PREFIXED_RE = /\ba\s+las?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
// "5pm", "5:30 am" — sin "a las" exigimos am/pm para no comerse números sueltos.
const TIME_MERIDIEM_RE = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function resolveHour(raw: number, meridiem: string | undefined, prefixed: boolean): number | null {
  if (meridiem === "pm") return raw < 12 ? raw + 12 : raw;
  if (meridiem === "am") return raw === 12 ? 0 : raw;
  // "a las 5" sin am/pm: 1–7 se asume tarde (17:00), 8–23 tal cual.
  if (prefixed) return raw >= 1 && raw <= 7 ? raw + 12 : raw;
  return null;
}

export function parseQuickDate(input: string, now: Date = new Date()): ParsedQuickDate | null {
  let rest = input;
  let dayOffset: number | null = null;
  let weekday: number | null = null;

  const pasado = rest.match(/\bpasado\s+ma[ñn]ana\b/i);
  if (pasado) {
    dayOffset = 2;
    rest = rest.replace(pasado[0], " ");
  } else {
    // "mañana" suelto = tomorrow; "la/esta mañana" = parte del día, no fecha.
    const tomorrow = rest.match(/(?<!\b(?:la|esta)\s)\bma[ñn]ana\b/i);
    if (tomorrow) {
      dayOffset = 1;
      rest = rest.replace(tomorrow[0], " ");
    } else if (/\bhoy\b/i.test(rest)) {
      dayOffset = 0;
      rest = rest.replace(/\bhoy\b/i, " ");
    } else {
      const wd = rest.match(WEEKDAY_RE);
      if (wd) {
        weekday = WEEKDAY_INDEX[stripAccents(wd[1].toLowerCase())];
        rest = rest.replace(wd[0], " ");
      }
    }
  }

  let dueTime: string | undefined;
  const time = rest.match(TIME_PREFIXED_RE) ?? rest.match(TIME_MERIDIEM_RE);
  if (time) {
    const hour = resolveHour(Number(time[1]), time[3]?.toLowerCase(), /^a\s/i.test(time[0]));
    const minute = Number(time[2] ?? 0);
    if (hour !== null && hour <= 23 && minute <= 59) {
      dueTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      rest = rest.replace(time[0], " ");
    }
  }

  if (dayOffset === null && weekday === null && !dueTime) return null;

  let day: Date;
  if (weekday !== null) {
    // Próxima ocurrencia estricta: "lunes" dicho un lunes = el lunes que viene.
    const diff = (weekday - now.getDay() + 7) % 7 || 7;
    day = addDays(now, diff);
  } else {
    day = addDays(now, dayOffset ?? 0); // solo hora → hoy
  }

  const title = rest.replace(/\s{2,}/g, " ").replace(/[\s,.\-–]+$/g, "").trim();

  return { title, dueDate: format(day, "yyyy-MM-dd"), dueTime };
}
