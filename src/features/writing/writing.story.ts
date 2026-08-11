import { and, asc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { db } from "@/shared/db";
import { entities, folders, pageEntityMentions, pages } from "@/shared/db/schema";
import { countWords } from "@/features/pages/word-count";
import { resolveMedium } from "@/shared/lib/mediums";
import { buildExcerpts, toPlainText } from "./story-text";
import type { EntityType } from "@/features/entities/entities.attributes";

/**
 * "Kino entiende tu historia" (PLAN-11 §10): las dos lecturas que un agente
 * necesita para razonar sobre una obra y que no existían como endpoint — la
 * estructura del manuscrito y la búsqueda dentro del texto. El resto de tools de
 * historia se montan sobre los endpoints de codex que ya dejó W2.
 */

export interface WorkChapter {
  id: string;
  title: string | null;
  wordCount: number;
  completed: boolean;
  updatedAt: string;
  entities: Array<{ id: string; name: string; type: EntityType; mentionCount: number }>;
}

export interface WorkStructure {
  folderId: string;
  name: string;
  medium: string;
  wordGoal: number | null;
  totalWords: number;
  chapters: WorkChapter[];
}

/**
 * Menciones del codex por capítulo. Exportada para compilarla a SQL en los tests
 * — el join a `entities` es justo el tipo de query que revienta en runtime si se
 * cuela una columna huérfana (ver entities.queries.test.ts).
 */
export function chapterMentionsQuery(chapterIds: string[]) {
  return db
    .select({
      pageId: pageEntityMentions.pageId,
      entityId: entities.id,
      name: entities.name,
      type: entities.type,
      mentionCount: pageEntityMentions.mentionCount,
    })
    .from(pageEntityMentions)
    .innerJoin(entities, eq(pageEntityMentions.entityId, entities.id))
    .where(
      and(inArray(pageEntityMentions.pageId, chapterIds), isNull(entities.deletedAt)),
    );
}

/** Obra → capítulos en orden, con el resumen de menciones de cada uno. */
export async function getWorkStructure(
  userId: string,
  folderId: string,
): Promise<WorkStructure | null> {
  const [folder] = await db
    .select({ id: folders.id, name: folders.name, metadata: folders.metadata })
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
    .limit(1);

  if (!folder) return null;

  const chapterRows = await db
    .select({
      id: pages.id,
      title: pages.title,
      content: pages.content,
      completedAt: pages.completedAt,
      updatedAt: pages.updatedAt,
    })
    .from(pages)
    .where(
      and(eq(pages.folderId, folderId), eq(pages.userId, userId), isNull(pages.deletedAt)),
    )
    .orderBy(asc(pages.createdAt));

  const chapterIds = chapterRows.map((c) => c.id);
  const mentionRows = chapterIds.length ? await chapterMentionsQuery(chapterIds) : [];

  const mentionsByPage = new Map<string, WorkChapter["entities"]>();
  for (const row of mentionRows) {
    const list = mentionsByPage.get(row.pageId) ?? [];
    list.push({
      id: row.entityId,
      name: row.name,
      type: row.type,
      mentionCount: row.mentionCount,
    });
    mentionsByPage.set(row.pageId, list);
  }

  const chapters: WorkChapter[] = chapterRows.map((c) => ({
    id: c.id,
    title: c.title,
    wordCount: countWords(c.content),
    completed: c.completedAt !== null,
    updatedAt: c.updatedAt.toISOString(),
    entities: (mentionsByPage.get(c.id) ?? []).sort(
      (a, b) => b.mentionCount - a.mentionCount,
    ),
  }));

  const wordGoalRaw = folder.metadata?.wordGoal;
  const wordGoal =
    typeof wordGoalRaw === "number"
      ? wordGoalRaw
      : typeof wordGoalRaw === "string"
        ? Number(wordGoalRaw) || null
        : null;

  return {
    folderId: folder.id,
    name: folder.name,
    medium: resolveMedium(folder.metadata),
    wordGoal,
    totalWords: chapters.reduce((sum, c) => sum + c.wordCount, 0),
    chapters,
  };
}

export interface StoryMatch {
  pageId: string;
  pageTitle: string | null;
  folderId: string | null;
  folderName: string | null;
  /** Fragmentos de texto plano alrededor de cada coincidencia. */
  excerpts: string[];
}

/**
 * Query de `search_story`, exportada para compilarla a SQL en los tests. El
 * término se escapa antes del LIKE: buscar "50%" o "_" son búsquedas legítimas
 * dentro de un manuscrito, no comodines.
 */
export function storySearchQuery(userId: string, systemId: string, rawQuery: string) {
  const query = rawQuery.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return db
    .select({
      id: pages.id,
      title: pages.title,
      content: pages.content,
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
        ilike(pages.content, `%${query}%`),
      ),
    )
    .limit(50);
}

/**
 * Busca una frase dentro del texto de las obras de un sistema y devuelve los
 * capítulos con sus fragmentos. El filtrado grueso lo hace Postgres (ILIKE sobre
 * el HTML) y el recorte fino se hace en memoria sobre el texto plano.
 */
export async function searchStory(
  userId: string,
  systemId: string,
  query: string,
): Promise<StoryMatch[]> {
  const rows = await storySearchQuery(userId, systemId, query);

  const matches: StoryMatch[] = [];
  for (const row of rows) {
    const excerpts = buildExcerpts(toPlainText(row.content), query);
    if (excerpts.length === 0) continue;
    matches.push({
      pageId: row.id,
      pageTitle: row.title,
      folderId: row.folderId,
      folderName: row.folderName,
      excerpts,
    });
  }
  return matches;
}
