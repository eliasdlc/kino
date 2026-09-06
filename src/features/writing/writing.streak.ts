import type { JournalDay, WorkMilestone, WritingSession } from "./writing.types";

/**
 * Lógica pura de motivación: racha y diario. Vive aparte del servicio para que
 * se pueda probar sin DB: es donde están las reglas que el usuario ve (cuándo
 * una racha sigue viva, cuándo se cruzó una meta), no el acceso a datos.
 */

const DAY_MS = 86_400_000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Día calendario anterior a un `yyyy-MM-dd`. Aritmética en UTC: es una fecha pura. */
export function previousDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const prev = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1) - DAY_MS);
  return `${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}-${pad(prev.getUTCDate())}`;
}

export interface StreakResult {
  streakDays: number;
  streakIncludesToday: boolean;
}

/**
 * Racha = días consecutivos con actividad, contando hacia atrás desde hoy.
 *
 * Si hoy todavía no escribiste, la racha no se rompe: se ancla en ayer y sigue
 * viva hasta que termine el día. Romperla a medianoche castigaría por no haber
 * escrito aún a las 9am.
 */
export function computeStreak(activeDays: Iterable<string>, today: string): StreakResult {
  const set = activeDays instanceof Set ? activeDays : new Set(activeDays);
  const yesterday = previousDay(today);

  let cursor: string;
  let streakIncludesToday: boolean;
  if (set.has(today)) {
    cursor = today;
    streakIncludesToday = true;
  } else if (set.has(yesterday)) {
    cursor = yesterday;
    streakIncludesToday = false;
  } else {
    return { streakDays: 0, streakIncludesToday: false };
  }

  let streakDays = 0;
  while (set.has(cursor)) {
    streakDays += 1;
    cursor = previousDay(cursor);
  }
  return { streakDays, streakIncludesToday };
}

/** Rachas que merecen un reconocimiento en el diario. */
const STREAK_MILESTONES = [7, 30, 100, 365];

export interface JournalInput {
  /** Sesiones de la obra, con el día local ya resuelto. */
  sessions: Array<WritingSession & { day: string }>;
  /** Capítulos terminados, con el día local en que se marcaron. */
  completions: Array<{ pageId: string; pageTitle: string | null; day: string }>;
  /** Notas marcadas como eureka, con el día local en que se escribieron. */
  breakthroughs?: Array<{ noteId: string; text: string; day: string }>;
  /** Palabras actuales de la obra (derivadas del contenido). */
  totalWords: number;
  wordGoal: number | null;
}

/**
 * Arma el diario de la obra: un día por fecha con actividad, sus sesiones y los
 * hitos que ocurrieron ahí.
 *
 * Los hitos no se persisten: se reconstruyen. La curva de palabras sale de
 * acumular los deltas de las sesiones sobre una línea base (`totalWords` menos
 * todo lo registrado), así una obra que ya tenía texto antes de W4 no aparece
 * cruzando su meta el primer día que se registró una sesión.
 */
export function buildJournal({
  sessions,
  completions,
  breakthroughs = [],
  totalWords,
  wordGoal,
}: JournalInput): JournalDay[] {
  const byDay = new Map<string, JournalDay>();

  const ensureDay = (day: string): JournalDay => {
    let entry = byDay.get(day);
    if (!entry) {
      entry = { day, sessions: [], words: 0, minutes: 0, cumulativeWords: 0, milestones: [] };
      byDay.set(day, entry);
    }
    return entry;
  };

  for (const session of sessions) {
    const entry = ensureDay(session.day);
    entry.sessions.push(session);
    entry.words += session.wordsWritten;
    entry.minutes += session.durationMinutes;
  }

  for (const completion of completions) {
    ensureDay(completion.day).milestones.push({
      kind: "chapter-completed",
      pageId: completion.pageId,
      pageTitle: completion.pageTitle,
    });
  }

  for (const breakthrough of breakthroughs) {
    ensureDay(breakthrough.day).milestones.push({
      kind: "breakthrough",
      noteId: breakthrough.noteId,
      text: breakthrough.text,
    });
  }

  const ascending = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));

  const recorded = sessions.reduce((sum, s) => sum + s.wordsWritten, 0);
  let cumulative = totalWords - recorded;
  let runLength = 0;
  let previousActiveDay: string | null = null;

  for (const entry of ascending) {
    const before = cumulative;
    cumulative += entry.words;
    entry.cumulativeWords = cumulative;

    if (wordGoal && wordGoal > 0 && before < wordGoal && cumulative >= wordGoal) {
      entry.milestones.push({ kind: "goal-reached", goal: wordGoal });
    }

    // La racha solo cuenta días con sesión: marcar un capítulo terminado no es
    // escribir, aunque sí sea un hito.
    if (entry.sessions.length > 0) {
      runLength = previousActiveDay && previousDay(entry.day) === previousActiveDay ? runLength + 1 : 1;
      previousActiveDay = entry.day;
      if (STREAK_MILESTONES.includes(runLength)) {
        entry.milestones.push({ kind: "streak", days: runLength });
      }
    }
  }

  return ascending.reverse();
}

/** Texto sobrio de un hito para el diario (sin emojis: regla de UI del proyecto). */
export function milestoneLabel(milestone: WorkMilestone): string {
  switch (milestone.kind) {
    case "chapter-completed":
      return `Terminaste «${milestone.pageTitle?.trim() || "Sin título"}»`;
    case "goal-reached":
      return `Alcanzaste la meta de ${milestone.goal.toLocaleString("es")} palabras`;
    case "streak":
      return `Racha de ${milestone.days} días escribiendo`;
    case "breakthrough":
      return milestone.text;
  }
}
