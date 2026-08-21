import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { entities, folders, pageEntityMentions, pages, systems } from "@/shared/db/schema";
import { countWords } from "@/shared/lib/word-count";
import { toPlainText } from "./story-text";
import { buildSuggestions, type StudioSignals, type Suggestion } from "./studio";
import { summarize, keyTerms, type SummarySentence } from "./summary";
import { getWritingOverview } from "./writing.service";
import { detectLooseThreads } from "./chekhov";
import { resolveChekhovSettings } from "./writing.chekhov";

/**
 * El estudio (KIN-143): la inteligencia de escritura **dentro de la app**, sin
 * LLM y por tanto sin costo recurrente.
 *
 * La decisión de producto de PLAN-11 sigue en pie —MCP primero, y eso ya está
 * entregado—, así que aquí no se compite con un agente: se resuelve la parte que
 * nunca necesitó inferencia. Qué obra lleva parada, qué capítulo quedó a medias,
 * qué entidades del universo aparecen sin ficha, qué frases concentran el
 * vocabulario de un capítulo. Todo sale de datos ya capturados y todo se puede
 * verificar en un clic.
 */

export interface CodexGap {
  entityId: string;
  name: string;
  mentions: number;
  chapters: number;
}

export interface StudioReport {
  systemId: string;
  suggestions: Suggestion[];
  /** Entidades muy nombradas y sin una línea que las describa. */
  codexGaps: CodexGap[];
  looseThreadCount: number;
}

/**
 * Entidades sin resumen ni atributos, ordenadas por cuánto se nombran. Una que
 * aparece en medio libro y no tiene ni una línea escrita es un agujero real de
 * continuidad — y a diferencia de un hilo suelto, se arregla en treinta segundos.
 */
export function codexGapsQuery(systemId: string, userId: string) {
  return db
    .select({
      entityId: entities.id,
      name: entities.name,
      mentions: sql<number>`SUM(${pageEntityMentions.mentionCount})::int`,
      chapters: sql<number>`COUNT(DISTINCT ${pageEntityMentions.pageId})::int`,
    })
    .from(entities)
    .innerJoin(pageEntityMentions, eq(pageEntityMentions.entityId, entities.id))
    .where(
      and(
        eq(entities.systemId, systemId),
        eq(entities.userId, userId),
        isNull(entities.deletedAt),
        isNull(entities.summary),
        isNull(entities.attributes),
      ),
    )
    .groupBy(entities.id, entities.name)
    .orderBy(desc(sql`SUM(${pageEntityMentions.mentionCount})`))
    .limit(5);
}

/** El capítulo sin terminar que se tocó más recientemente. */
export function openChapterQuery(systemId: string, userId: string) {
  return db
    .select({
      id: pages.id,
      title: pages.title,
      content: pages.content,
      updatedAt: pages.updatedAt,
      folderId: pages.folderId,
      folderName: folders.name,
    })
    .from(pages)
    .leftJoin(folders, eq(pages.folderId, folders.id))
    .where(
      and(
        eq(pages.systemId, systemId),
        eq(pages.userId, userId),
        isNull(pages.deletedAt),
        isNull(pages.completedAt),
      ),
    )
    .orderBy(desc(pages.updatedAt))
    .limit(1);
}

const DAY_MS = 86_400_000;

export async function getStudioReport(
  userId: string,
  systemId: string,
): Promise<StudioReport | null> {
  const overview = await getWritingOverview(userId, systemId);
  if (!overview) return null;

  const [gaps, openRows, works] = await Promise.all([
    codexGapsQuery(systemId, userId),
    openChapterQuery(systemId, userId),
    db
      .select({ id: folders.id, name: folders.name })
      .from(folders)
      .where(and(eq(folders.systemId, systemId), eq(folders.userId, userId))),
  ]);

  const looseThreadCount = await countLooseThreads(userId, systemId, works);

  const open = openRows[0];
  const worksById = new Map(works.map((w) => [w.id, w.name]));

  // La obra más parada sale del pulso real de sesiones que ya calcula W4.
  const stalest = [...overview.works]
    .filter((w) => w.daysSinceLastSession !== null)
    .sort((a, b) => (b.daysSinceLastSession ?? 0) - (a.daysSinceLastSession ?? 0))[0];

  const signals: StudioSignals = {
    openChapter: open
      ? {
          pageId: open.id,
          title: open.title,
          folderName: open.folderName ?? "sin obra",
          wordCount: countWords(open.content),
          daysSinceEdit: Math.max(
            0,
            Math.floor((Date.now() - open.updatedAt.getTime()) / DAY_MS),
          ),
        }
      : null,
    staleWork: stalest
      ? {
          folderId: stalest.folderId,
          name: worksById.get(stalest.folderId) ?? "la obra",
          daysSinceLastSession: stalest.daysSinceLastSession ?? 0,
        }
      : null,
    wordsToday: overview.wordsToday,
    dailyWordGoal: overview.dailyWordGoal,
    peakWindow: overview.peakWindow,
    currentHour: overview.currentHour,
    looseThreadCount,
    hasAnyChapter: openRows.length > 0 || works.length > 0,
  };

  return {
    systemId,
    suggestions: buildSuggestions(signals),
    codexGaps: gaps.map((g) => ({
      entityId: g.entityId,
      name: g.name,
      mentions: g.mentions ?? 0,
      chapters: g.chapters ?? 0,
    })),
    looseThreadCount,
  };
}

/**
 * Cuenta los hilos sueltos abiertos de todo el sistema. Reutiliza el criterio de
 * KIN-137 en vez de tener una segunda definición de "hilo suelto" que se pueda
 * ir de la primera.
 */
async function countLooseThreads(
  userId: string,
  systemId: string,
  works: Array<{ id: string }>,
): Promise<number> {
  if (works.length === 0) return 0;

  const [universe, chapterRows, mentionRows, systemRows] = await Promise.all([
    db
      .select({
        id: entities.id,
        name: entities.name,
        type: entities.type,
        threadResolvedMentions: entities.threadResolvedMentions,
      })
      .from(entities)
      .where(
        and(
          eq(entities.systemId, systemId),
          eq(entities.userId, userId),
          isNull(entities.deletedAt),
        ),
      ),
    db
      .select({ id: pages.id, title: pages.title, folderId: pages.folderId })
      .from(pages)
      .where(
        and(
          eq(pages.systemId, systemId),
          eq(pages.userId, userId),
          isNull(pages.deletedAt),
        ),
      )
      .orderBy(asc(pages.createdAt)),
    db
      .select({
        entityId: pageEntityMentions.entityId,
        pageId: pageEntityMentions.pageId,
        mentionCount: pageEntityMentions.mentionCount,
      })
      .from(pageEntityMentions)
      .innerJoin(pages, eq(pageEntityMentions.pageId, pages.id))
      .where(and(eq(pages.systemId, systemId), isNull(pages.deletedAt))),
    db
      .select({ metadata: systems.metadata })
      .from(systems)
      .where(and(eq(systems.id, systemId), eq(systems.userId, userId)))
      .limit(1),
  ]);

  // Los mismos umbrales que ve el detector en su pantalla: si el autor bajó la
  // sensibilidad, el estudio no puede seguir contando por su cuenta.
  const settings = resolveChekhovSettings(systemRows[0]?.metadata?.chekhov);

  const totals = new Map<string, number>();
  for (const row of mentionRows) {
    totals.set(row.entityId, (totals.get(row.entityId) ?? 0) + row.mentionCount);
  }

  let count = 0;
  for (const work of works) {
    const chapters = chapterRows.filter((c) => c.folderId === work.id);
    if (chapters.length === 0) continue;
    const threads = detectLooseThreads({
      chapters: chapters.map((c) => ({ id: c.id, title: c.title })),
      appearances: mentionRows,
      entities: universe.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        mentionsInSystem: totals.get(e.id) ?? 0,
        threadResolvedMentions: e.threadResolvedMentions,
      })),
      settings,
    });
    count += threads.filter((t) => !t.resolved).length;
  }
  return count;
}

export interface ChapterSummary {
  pageId: string;
  title: string | null;
  wordCount: number;
  sentences: SummarySentence[];
  keyTerms: string[];
}

/**
 * Resumen extractivo de un capítulo. Las entidades del universo entran como
 * pistas de peso: donde se nombra a alguien del codex, suele estar pasando algo.
 */
export async function getChapterSummary(
  userId: string,
  pageId: string,
): Promise<ChapterSummary | null> {
  const [page] = await db
    .select({
      id: pages.id,
      title: pages.title,
      content: pages.content,
      systemId: pages.systemId,
    })
    .from(pages)
    .where(
      and(eq(pages.id, pageId), eq(pages.userId, userId), isNull(pages.deletedAt)),
    )
    .limit(1);

  if (!page) return null;

  const universe = page.systemId
    ? await db
        .select({ name: entities.name, aliases: entities.aliases })
        .from(entities)
        .where(
          and(
            eq(entities.systemId, page.systemId),
            eq(entities.userId, userId),
            isNull(entities.deletedAt),
          ),
        )
    : [];

  const text = toPlainText(page.content);
  const entityNames = universe.flatMap((e) => [e.name, ...(e.aliases ?? [])]);

  return {
    pageId: page.id,
    title: page.title,
    wordCount: countWords(page.content),
    sentences: summarize({ text, entityNames }),
    keyTerms: keyTerms(text),
  };
}
