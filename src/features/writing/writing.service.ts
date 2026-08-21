import { and, desc, eq, gte, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { folders, pages, stickyNotes, systems, timeLogs } from "@/shared/db/schema";
import { calendarDayInTz, userToday } from "@/shared/time";
import { getUserTimezone } from "@/shared/time/user-timezone";
import { getPeakWindow } from "@/features/energy/energy.service";
import { countWords } from "@/shared/lib/word-count";
import { buildJournal, computeStreak } from "./writing.streak";
import { captureSnapshot } from "./writing.snapshots";
import type {
  WorkJournal,
  WorkPulse,
  WritingOverview,
  WritingSession,
} from "./writing.types";

/**
 * Sesiones de escritura (PLAN-11 §9). No las arranca el usuario: el server las
 * deriva de los guardados del capítulo y las agrupa por hueco de inactividad,
 * igual que un tracker de actividad. Escribir sin acordarse de darle a un botón
 * sigue alimentando la racha, que es justo lo que la hace creíble.
 *
 * Viven en `time_logs` con `page_id` (ver el comentario del schema): así el
 * tiempo de escritura cuenta como actividad del sistema en insights sin duplicar
 * tablas ni contadores.
 */

/** Hueco tras el cual un guardado abre sesión nueva en vez de extender la anterior. */
const SESSION_GAP_MINUTES = 20;
const DAY_MS = 86_400_000;
/** Ventana de días que se mira hacia atrás para calcular la racha. */
const STREAK_LOOKBACK_DAYS = 400;

export interface RecordWritingActivityInput {
  userId: string;
  systemId: string;
  pageId: string;
  /** Delta neto de palabras del guardado; puede ser negativo (recortar cuenta). */
  wordsDelta: number;
  /**
   * Texto del capítulo **antes** de este guardado. Al abrir sesión nueva se
   * archiva como versión (KIN-142): es exactamente cómo quedó el capítulo la
   * última vez que el autor paró.
   */
  previousContent?: string | null;
}

/**
 * Registra actividad de escritura sobre un capítulo. Extiende la sesión abierta
 * si el último guardado fue hace menos de `SESSION_GAP_MINUTES`; si no, abre una.
 *
 * Se llama incluso con delta 0: reescribir un párrafo sin cambiar el conteo es
 * trabajo, y marca el día como activo.
 */
export async function recordWritingActivity({
  userId,
  systemId,
  pageId,
  wordsDelta,
  previousContent,
}: RecordWritingActivityInput): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - SESSION_GAP_MINUTES * 60_000);

  const [open] = await db
    .select({
      id: timeLogs.id,
      startedAt: timeLogs.startedAt,
      wordsWritten: timeLogs.wordsWritten,
    })
    .from(timeLogs)
    .where(
      and(
        eq(timeLogs.userId, userId),
        eq(timeLogs.pageId, pageId),
        eq(timeLogs.source, "writing"),
        gte(timeLogs.endedAt, cutoff),
      ),
    )
    .orderBy(desc(timeLogs.endedAt))
    .limit(1);

  if (open) {
    await db
      .update(timeLogs)
      .set({
        endedAt: now,
        durationMinutes: Math.max(
          0,
          Math.round((now.getTime() - open.startedAt.getTime()) / 60_000),
        ),
        wordsWritten: (open.wordsWritten ?? 0) + wordsDelta,
      })
      .where(eq(timeLogs.id, open.id));
    return;
  }

  // Sesión nueva: el texto que había hasta ahora es el resultado de la anterior,
  // así que este es el corte natural para archivarlo (KIN-142). Best-effort — el
  // historial no puede tumbar un guardado; la siguiente sesión lo reintenta.
  if (previousContent !== undefined) {
    try {
      await captureSnapshot({
        pageId,
        userId,
        content: previousContent,
        sessionStartedAt: null,
      });
    } catch (err) {
      console.error("captureSnapshot failed", { pageId, err });
    }
  }

  await db.insert(timeLogs).values({
    userId,
    systemId,
    pageId,
    startedAt: now,
    endedAt: now,
    durationMinutes: 0,
    wordsWritten: wordsDelta,
    source: "writing",
  });
}

/**
 * Cierra una sesión cronometrada lanzada desde la obra (§9). No inserta una fila
 * nueva: refina la sesión auto-detectada que cubre esa ventana. El timer sabe el
 * tiempo real de foco (empezó antes del primer guardado y sigue después del
 * último); el detector solo ve de guardado a guardado. Quedarse con el mayor de
 * los dos evita contar los mismos minutos dos veces.
 */
export async function closeWritingSession({
  userId,
  pageId,
  startedAt,
  endedAt,
  durationMinutes,
}: {
  userId: string;
  pageId: string;
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
}): Promise<{ durationMinutes: number; wordsWritten: number } | null> {
  const [page] = await db
    .select({ systemId: pages.systemId })
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.userId, userId), isNull(pages.deletedAt)))
    .limit(1);

  if (!page?.systemId) return null;

  const [open] = await db
    .select({
      id: timeLogs.id,
      startedAt: timeLogs.startedAt,
      endedAt: timeLogs.endedAt,
      durationMinutes: timeLogs.durationMinutes,
      wordsWritten: timeLogs.wordsWritten,
    })
    .from(timeLogs)
    .where(
      and(
        eq(timeLogs.userId, userId),
        eq(timeLogs.pageId, pageId),
        eq(timeLogs.source, "writing"),
        gte(timeLogs.endedAt, startedAt),
      ),
    )
    .orderBy(desc(timeLogs.startedAt))
    .limit(1);

  if (!open) {
    // Sesión sin una sola palabra: se registra igual, el tiempo frente a la
    // página también es trabajo (y mantiene viva la racha del día).
    await db.insert(timeLogs).values({
      userId,
      systemId: page.systemId,
      pageId,
      startedAt,
      endedAt,
      durationMinutes,
      wordsWritten: 0,
      source: "writing",
    });
    return { durationMinutes, wordsWritten: 0 };
  }

  const mergedDuration = Math.max(open.durationMinutes, durationMinutes);
  await db
    .update(timeLogs)
    .set({
      startedAt: open.startedAt < startedAt ? open.startedAt : startedAt,
      endedAt: (open.endedAt ?? endedAt) > endedAt ? open.endedAt : endedAt,
      durationMinutes: mergedDuration,
    })
    .where(eq(timeLogs.id, open.id));

  return { durationMinutes: mergedDuration, wordsWritten: open.wordsWritten ?? 0 };
}

/** Fragmento SQL: día calendario local de `started_at` como `yyyy-MM-dd`. */
function sqlLocalDay(timezone: string) {
  return sql<string>`to_char(${timeLogs.startedAt} AT TIME ZONE ${timezone}, 'YYYY-MM-DD')`;
}

/**
 * Días con sesión de escritura en el sistema — la materia prima de la racha.
 * Exportada para compilarla a SQL en los tests (ver entities.queries.test.ts:
 * una columna huérfana solo se detecta al construir la query).
 */
export function writingActivityDaysQuery(
  userId: string,
  systemId: string,
  timezone: string,
  since: Date,
) {
  return db
    .select({ day: sqlLocalDay(timezone), words: timeLogs.wordsWritten })
    .from(timeLogs)
    .where(
      and(
        eq(timeLogs.userId, userId),
        eq(timeLogs.systemId, systemId),
        isNotNull(timeLogs.pageId),
        gte(timeLogs.startedAt, since),
      ),
    );
}

/** Última sesión por obra: alimenta el aviso de "lleva N días sin sesión". */
export function workPulseQuery(userId: string, systemId: string) {
  return db
    .select({
      folderId: pages.folderId,
      lastSessionAt: sql<string | null>`MAX(${timeLogs.startedAt})`,
    })
    .from(timeLogs)
    .innerJoin(pages, eq(timeLogs.pageId, pages.id))
    .where(
      and(
        eq(timeLogs.userId, userId),
        eq(timeLogs.systemId, systemId),
        isNotNull(pages.folderId),
      ),
    )
    .groupBy(pages.folderId);
}

/**
 * Notas "eureka" de una obra: las de sus capítulos y las ancladas a la obra
 * misma. Son los breakthroughs que el diario recoge (§9).
 */
export function workBreakthroughsQuery(userId: string, folderId: string) {
  return db
    .select({
      id: stickyNotes.id,
      title: stickyNotes.title,
      content: stickyNotes.content,
      createdAt: stickyNotes.createdAt,
      pageFolderId: pages.folderId,
    })
    .from(stickyNotes)
    .leftJoin(pages, eq(stickyNotes.pageId, pages.id))
    .where(
      and(
        eq(stickyNotes.userId, userId),
        eq(stickyNotes.isEureka, true),
        or(eq(stickyNotes.folderId, folderId), eq(pages.folderId, folderId)),
      ),
    );
}

/** Sesiones de una obra, con el título del capítulo y su día local. */
export function workSessionsQuery(userId: string, folderId: string, timezone: string) {
  return db
    .select({
      id: timeLogs.id,
      pageId: timeLogs.pageId,
      pageTitle: pages.title,
      startedAt: timeLogs.startedAt,
      endedAt: timeLogs.endedAt,
      durationMinutes: timeLogs.durationMinutes,
      wordsWritten: timeLogs.wordsWritten,
      day: sqlLocalDay(timezone),
    })
    .from(timeLogs)
    .innerJoin(pages, eq(timeLogs.pageId, pages.id))
    .where(
      and(
        eq(timeLogs.userId, userId),
        eq(pages.folderId, folderId),
        isNull(pages.deletedAt),
      ),
    )
    .orderBy(desc(timeLogs.startedAt));
}

/**
 * Panorama de motivación de un sistema writing: racha, palabras de hoy contra la
 * meta diaria, ventana creativa y el pulso de cada obra.
 */
export async function getWritingOverview(
  userId: string,
  systemId: string,
): Promise<WritingOverview | null> {
  const [system] = await db
    .select({ metadata: systems.metadata })
    .from(systems)
    .where(and(eq(systems.id, systemId), eq(systems.userId, userId)))
    .limit(1);

  if (!system) return null;

  const timezone = await getUserTimezone(userId);
  const today = userToday(timezone);
  const lookbackFrom = new Date(Date.now() - STREAK_LOOKBACK_DAYS * DAY_MS);

  // Una sola pasada por las sesiones del último año: de ahí salen tanto los días
  // activos (racha) como las palabras de hoy, sin una segunda query.
  const [activityRows, workRows, peakWindow] = await Promise.all([
    writingActivityDaysQuery(userId, systemId, timezone, lookbackFrom),
    workPulseQuery(userId, systemId),
    getPeakWindow(userId),
  ]);

  const { streakDays, streakIncludesToday } = computeStreak(
    activityRows.map((r) => r.day),
    today,
  );

  const wordsToday = activityRows
    .filter((r) => r.day === today)
    .reduce((sum, r) => sum + (r.words ?? 0), 0);

  const works: WorkPulse[] = workRows.map((row) => {
    const lastSessionAt = row.lastSessionAt ? new Date(row.lastSessionAt) : null;
    return {
      folderId: row.folderId!,
      lastSessionAt: lastSessionAt?.toISOString() ?? null,
      daysSinceLastSession: lastSessionAt
        ? daysBetween(calendarDayInTz(lastSessionAt, timezone), today)
        : null,
    };
  });

  const dailyWordGoal = system.metadata?.dailyWordGoal ?? null;

  return {
    streakDays,
    streakIncludesToday,
    wordsToday,
    dailyWordGoal: dailyWordGoal && dailyWordGoal > 0 ? dailyWordGoal : null,
    peakWindow,
    currentHour: Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hour12: false,
      }).format(new Date()),
    ) % 24,
    works,
  };
}

/** Días calendario entre dos `yyyy-MM-dd` (from ≤ to). */
function daysBetween(from: string, to: string): number {
  const parse = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
  };
  return Math.max(0, Math.round((parse(to) - parse(from)) / DAY_MS));
}

/**
 * Diario de la obra: el histórico legible de sesiones e hitos que convierte el
 * progreso invisible en algo que se puede releer cuando falta motivación (§9).
 */
export async function getWorkJournal(
  userId: string,
  folderId: string,
): Promise<WorkJournal | null> {
  const [folder] = await db
    .select({ id: folders.id, name: folders.name, metadata: folders.metadata })
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
    .limit(1);

  if (!folder) return null;

  const timezone = await getUserTimezone(userId);

  const [chapterRows, sessionRows, breakthroughRows] = await Promise.all([
    db
      .select({
        id: pages.id,
        title: pages.title,
        content: pages.content,
        completedAt: pages.completedAt,
      })
      .from(pages)
      .where(
        and(
          eq(pages.folderId, folderId),
          eq(pages.userId, userId),
          isNull(pages.deletedAt),
        ),
      ),
    workSessionsQuery(userId, folderId, timezone),
    workBreakthroughsQuery(userId, folderId),
  ]);

  const sessions = sessionRows.map((row) => ({
    id: row.id,
    pageId: row.pageId!,
    pageTitle: row.pageTitle,
    folderId,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    durationMinutes: row.durationMinutes,
    wordsWritten: row.wordsWritten ?? 0,
    day: row.day,
  })) satisfies Array<WritingSession & { day: string }>;

  const completions = chapterRows
    .filter((c) => c.completedAt !== null)
    .map((c) => ({
      pageId: c.id,
      pageTitle: c.title,
      day: calendarDayInTz(c.completedAt!, timezone),
    }));

  const breakthroughs = breakthroughRows
    .map((n) => ({
      noteId: n.id,
      text: [n.title, n.content].filter(Boolean).join(" — ").trim(),
      day: calendarDayInTz(n.createdAt, timezone),
    }))
    .filter((n) => n.text.length > 0);

  const totalWords = chapterRows.reduce((sum, c) => sum + countWords(c.content), 0);
  const wordGoal = readWordGoal(folder.metadata);

  return {
    folderId: folder.id,
    folderName: folder.name,
    wordGoal,
    totalWords,
    days: buildJournal({ sessions, completions, breakthroughs, totalWords, wordGoal }),
  };
}

function readWordGoal(metadata: Record<string, unknown> | null): number | null {
  const raw = metadata?.wordGoal;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string") return Number(raw) || null;
  return null;
}

/**
 * Marca o desmarca un capítulo como terminado. Devuelve el instante guardado
 * para que la UI celebre solo cuando de verdad pasó de en curso a terminado.
 */
export async function setChapterCompleted(
  pageId: string,
  userId: string,
  completed: boolean,
): Promise<{ id: string; completedAt: string | null } | null> {
  const [updated] = await db
    .update(pages)
    .set({ completedAt: completed ? new Date() : null, updatedAt: new Date() })
    .where(
      and(eq(pages.id, pageId), eq(pages.userId, userId), isNull(pages.deletedAt)),
    )
    .returning({ id: pages.id, completedAt: pages.completedAt });

  if (!updated) return null;
  return { id: updated.id, completedAt: updated.completedAt?.toISOString() ?? null };
}
