/** Una sesión de escritura: minutos y palabras netas sobre un capítulo. */
export interface WritingSession {
  id: string;
  pageId: string;
  pageTitle: string | null;
  folderId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
  wordsWritten: number;
}

/** Hito del diario de la obra — todos derivados, ninguno persistido como tal. */
export type WorkMilestone =
  | { kind: "chapter-completed"; pageId: string; pageTitle: string | null }
  | { kind: "goal-reached"; goal: number }
  | { kind: "streak"; days: number }
  | { kind: "breakthrough"; noteId: string; text: string };

/** Un día del diario de la obra: lo que se escribió y lo que se logró. */
export interface JournalDay {
  /** yyyy-MM-dd en la timezone del usuario. */
  day: string;
  sessions: WritingSession[];
  words: number;
  minutes: number;
  /** Palabras acumuladas de la obra al cerrar ese día. */
  cumulativeWords: number;
  milestones: WorkMilestone[];
}

export interface WorkJournal {
  folderId: string;
  folderName: string;
  wordGoal: number | null;
  totalWords: number;
  days: JournalDay[];
}

/** Estado de una obra dentro del panorama del sistema. */
export interface WorkPulse {
  folderId: string;
  lastSessionAt: string | null;
  /** Días completos desde la última sesión; null si nunca hubo una. */
  daysSinceLastSession: number | null;
}

/** Panorama de motivación del sistema writing (racha, metas, ventana creativa). */
export interface WritingOverview {
  /** Días consecutivos escribiendo, contando hasta hoy (o hasta ayer si hoy aún no). */
  streakDays: number;
  /** La racha ya incluye hoy — cambia el tono del mensaje ("vas" vs "no la pierdas"). */
  streakIncludesToday: boolean;
  wordsToday: number;
  dailyWordGoal: number | null;
  /** Ventana creativa aprendida del perfil de energía, en horas locales. */
  peakWindow: { start: number; end: number } | null;
  /** Hora local actual del usuario — decide si la ventana es "ahora". */
  currentHour: number;
  works: WorkPulse[];
}
