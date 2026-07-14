import { RRule } from "rrule";

/** Reglas RRULE que ofrece el selector simple de la UI. */
export const RECURRENCE_PRESETS = {
  daily: "FREQ=DAILY",
  weekly: "FREQ=WEEKLY",
  monthly: "FREQ=MONTHLY",
} as const;

/** True si el string es un RRULE parseable. Vacío/nulo = sin recurrencia (válido). */
export function isValidRRule(rule: string | null | undefined): boolean {
  if (!rule) return true;
  try {
    RRule.fromString(rule);
    return true;
  } catch {
    return false;
  }
}

/**
 * Próxima ocurrencia estrictamente posterior a `fromDate`, o `null` si la serie
 * se agotó (COUNT/UNTIL). Si la regla no trae `DTSTART` propio (caso de los
 * presets de la UI), se ancla a `fromDate` para que "cada lunes" avance desde
 * el lunes de la tarea, no desde una fecha arbitraria.
 */
export function computeNextOccurrence(rule: string, fromDate: Date): Date | null {
  let parsed: RRule;
  try {
    parsed = RRule.fromString(rule);
  } catch {
    return null;
  }

  const anchored = parsed.origOptions.dtstart
    ? parsed
    : new RRule({ ...parsed.origOptions, dtstart: fromDate });

  // after(date, false): siguiente ocurrencia sin incluir `fromDate` mismo.
  return anchored.after(fromDate, false);
}

const WEEKDAY_LABELS: Record<number, string> = {
  0: "lunes",
  1: "martes",
  2: "miércoles",
  3: "jueves",
  4: "viernes",
  5: "sábado",
  6: "domingo",
};

/** Descripción corta en español para la UI. Cae a "Personalizada" si no es un
 *  caso simple (diaria/semanal/mensual). */
export function describeRecurrence(rule: string | null | undefined): string | null {
  if (!rule) return null;
  let parsed: RRule;
  try {
    parsed = RRule.fromString(rule);
  } catch {
    return "Personalizada";
  }

  const freq = parsed.options.freq;
  const interval = parsed.options.interval;
  const everyN = interval && interval > 1;

  if (freq === RRule.DAILY) return everyN ? `Cada ${interval} días` : "Cada día";
  if (freq === RRule.MONTHLY) return everyN ? `Cada ${interval} meses` : "Cada mes";
  if (freq === RRule.WEEKLY) {
    // origOptions.byweekday: solo lo explícito en el string. `options.byweekday`
    // lo rellena rrule desde el dtstart, así que no sirve para describir.
    const explicitDays = normalizeWeekdays(parsed.origOptions.byweekday);
    if (explicitDays.length > 0) {
      const days = explicitDays.map((d) => WEEKDAY_LABELS[d]).filter(Boolean).join(", ");
      return `Cada semana: ${days}`;
    }
    return everyN ? `Cada ${interval} semanas` : "Cada semana";
  }
  return "Personalizada";
}

/** Normaliza el byweekday de origOptions (Weekday | number | array | null) a
 *  una lista de índices 0..6 (0 = lunes), como los usa WEEKDAY_LABELS. */
const WEEKDAY_CODES: Record<string, number> = {
  MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6,
};

function normalizeWeekdays(byweekday: RRule["origOptions"]["byweekday"]): number[] {
  if (byweekday === null || byweekday === undefined) return [];
  const arr = Array.isArray(byweekday) ? byweekday : [byweekday];
  return arr.map((d) => {
    if (typeof d === "number") return d;
    if (typeof d === "string") return WEEKDAY_CODES[d] ?? -1;
    return d.weekday;
  });
}
