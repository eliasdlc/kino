import { addDays, format } from "date-fns";

export interface ParsedQuickDate {
  /** Título sin los tokens de fecha (puede quedar vacío). */
  title: string;
  /** Día detectado, formato yyyy-MM-dd. */
  dueDate: string;
  /** Hora detectada, formato HH:mm (24h). */
  dueTime?: string;
}

export interface ParsedQuickInput {
  title: string;
  dueDate?: string;
  dueTime?: string;
  priority?: "critical" | "high" | "medium" | "low";
  systemHint?: string;
  tagHint?: string;
  estimatedMinutes?: number;
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

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function resolveHour(raw: number, meridiem: string | undefined, prefixed: boolean): number | null {
  if (meridiem === "pm") return raw < 12 ? raw + 12 : raw;
  if (meridiem === "am") return raw === 12 ? 0 : raw;
  // "a las 5" sin am/pm: 1–7 se asume tarde (17:00), 8–23 tal cual.
  if (prefixed) return raw >= 1 && raw <= 7 ? raw + 12 : raw;
  return null;
}

// ── Sub-parsers ────────────────────────────────────────────────────────────────

function parsePriority(
  rest: string,
): { priority: "critical" | "high" | "medium" | "low"; rest: string } | null {
  const tokenMatch = rest.match(/(!1|!2|!3|!4)\b/);
  if (tokenMatch) {
    const map: Record<string, "critical" | "high" | "medium" | "low"> = {
      "!1": "critical",
      "!2": "high",
      "!3": "medium",
      "!4": "low",
    };
    return { priority: map[tokenMatch[1]], rest: rest.replace(tokenMatch[0], " ") };
  }

  const normalized = stripAccents(rest).toLowerCase();
  const candidates: Array<[string, "critical" | "high" | "medium" | "low"]> = [
    // Critical — EN
    ["emergency", "critical"],
    ["panic", "critical"],
    ["crash", "critical"],
    ["outage", "critical"],
    ["blocker", "critical"],
    ["urgent", "critical"],
    ["breach", "critical"],
    ["severe", "critical"],
    // Critical — ES
    ["critico", "critical"],
    ["emergencia", "critical"],
    ["urgente", "critical"],
    ["caida", "critical"],
    ["bloqueo", "critical"],
    // High — EN (longer variants first to avoid partial matches)
    ["vulnerability", "high"],
    ["exception", "high"],
    ["failure", "high"],
    ["denied", "high"],
    ["error", "high"],
    ["alert", "high"],
    // High — ES
    ["excepcion", "high"],
    ["denegado", "high"],
    ["fallo", "high"],
    ["alerta", "high"],
    // Medium — EN (longer variants first)
    ["warning", "medium"],
    ["timeout", "medium"],
    ["degraded", "medium"],
    ["anomaly", "medium"],
    ["retry", "medium"],
    ["issue", "medium"],
    // Medium — ES
    ["advertencia", "medium"],
    ["reintento", "medium"],
    ["anomalia", "medium"],
    ["retraso", "medium"],
    ["problema", "medium"],
    // Low — EN
    ["routine", "low"],
    ["trivial", "low"],
    ["success", "low"],
    ["notice", "low"],
    ["debug", "low"],
    ["trace", "low"],
    ["info", "low"],
    // Low — ES
    ["rutina", "low"],
    ["exito", "low"],
    ["aviso", "low"],
    ["traza", "low"],
    ["algun dia", "low"],
    ["someday", "low"],
  ];

  for (const [word, priority] of candidates) {
    const idx = normalized.indexOf(word);
    if (idx === -1) continue;
    const before = idx === 0 || !/\w/.test(normalized[idx - 1]);
    const after = idx + word.length >= normalized.length || !/\w/.test(normalized[idx + word.length]);
    if (before && after) {
      return { priority, rest: rest.slice(0, idx) + " " + rest.slice(idx + word.length) };
    }
  }

  return null;
}

function parseSystem(rest: string): { systemHint: string; rest: string } | null {
  const match = rest.match(/@(\w+)/);
  if (!match) return null;
  return { systemHint: match[1], rest: rest.replace(match[0], " ") };
}

function parseTag(rest: string): { tagHint: string; rest: string } | null {
  const match = rest.match(/#(\w+)/);
  if (!match) return null;
  return { tagHint: match[1], rest: rest.replace(match[0], " ") };
}

function parseDuration(rest: string): { estimatedMinutes: number; rest: string } | null {
  // "1h30", "1h30min", "1h 30min" — horas + minutos
  const combined = rest.match(/\b(\d+)\s*h(?:oras?)?\s*(\d{1,3})\s*(?:min(?:utos?)?)?\b/i);
  if (combined) {
    return {
      estimatedMinutes: parseInt(combined[1]) * 60 + parseInt(combined[2]),
      rest: rest.replace(combined[0], " "),
    };
  }
  // "1h", "2h"
  const hoursOnly = rest.match(/\b(\d+)\s*h(?:oras?)?\b/i);
  if (hoursOnly) {
    return { estimatedMinutes: parseInt(hoursOnly[1]) * 60, rest: rest.replace(hoursOnly[0], " ") };
  }
  // "30min", "30m"
  const minsOnly = rest.match(/\b(\d+)\s*(?:min(?:utos?)?|m)\b/i);
  if (minsOnly) {
    return { estimatedMinutes: parseInt(minsOnly[1]), rest: rest.replace(minsOnly[0], " ") };
  }
  return null;
}

// ── Orquestadores ──────────────────────────────────────────────────────────────

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

export function parseQuickInput(input: string, now: Date = new Date()): ParsedQuickInput | null {
  const dateResult = parseQuickDate(input, now);
  let rest = dateResult ? dateResult.title : input;

  const result: ParsedQuickInput = { title: input };
  let anyMatch = false;

  if (dateResult) {
    result.dueDate = dateResult.dueDate;
    result.dueTime = dateResult.dueTime;
    anyMatch = true;
  }

  const priorityResult = parsePriority(rest);
  if (priorityResult) {
    result.priority = priorityResult.priority;
    rest = priorityResult.rest;
    anyMatch = true;
  }

  const systemResult = parseSystem(rest);
  if (systemResult) {
    result.systemHint = systemResult.systemHint;
    rest = systemResult.rest;
    anyMatch = true;
  }

  const tagResult = parseTag(rest);
  if (tagResult) {
    result.tagHint = tagResult.tagHint;
    rest = tagResult.rest;
    anyMatch = true;
  }

  const durationResult = parseDuration(rest);
  if (durationResult) {
    result.estimatedMinutes = durationResult.estimatedMinutes;
    rest = durationResult.rest;
    anyMatch = true;
  }

  result.title = rest.replace(/\s{2,}/g, " ").replace(/[\s,.\-–]+$/g, "").trim();

  return anyMatch ? result : null;
}
