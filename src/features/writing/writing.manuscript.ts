import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/shared/db";
import { folders, pages, users } from "@/shared/db/schema";
import { countWords } from "@/shared/lib/word-count";
import { resolveMedium, type MediumId } from "@/shared/lib/mediums";

/**
 * El manuscrito completo de una obra: sus capítulos en orden, con contenido.
 *
 * Lo comparten el modo lectura (KIN-138) y la compilación a un solo archivo
 * (KIN-139) porque las dos responden a la misma pregunta —"¿cómo queda la obra
 * entera?"— y solo se diferencian en la salida. El orden es el de creación, que
 * es el orden de lectura de una obra en todo el Writing System (§7).
 */

export interface ManuscriptChapter {
  id: string;
  title: string | null;
  content: string | null;
  wordCount: number;
  completed: boolean;
}

export interface Manuscript {
  folderId: string;
  systemId: string;
  title: string;
  /** Nombre del autor para la portada; el del usuario, no un campo aparte. */
  author: string | null;
  medium: MediumId;
  totalWords: number;
  chapters: ManuscriptChapter[];
}

/** Capítulos de una obra con su contenido. Exportada para compilarla a SQL. */
export function manuscriptChaptersQuery(folderId: string, userId: string) {
  return db
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
    )
    .orderBy(asc(pages.createdAt));
}

export async function getManuscript(
  userId: string,
  folderId: string,
): Promise<Manuscript | null> {
  const [folder] = await db
    .select({
      id: folders.id,
      name: folders.name,
      systemId: folders.systemId,
      metadata: folders.metadata,
    })
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
    .limit(1);

  if (!folder?.systemId) return null;

  const [chapterRows, [author]] = await Promise.all([
    manuscriptChaptersQuery(folderId, userId),
    db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1),
  ]);

  const chapters: ManuscriptChapter[] = chapterRows.map((c) => ({
    id: c.id,
    title: c.title,
    content: c.content,
    wordCount: countWords(c.content),
    completed: c.completedAt !== null,
  }));

  return {
    folderId: folder.id,
    systemId: folder.systemId,
    title: folder.name,
    author: author?.name?.trim() || null,
    medium: resolveMedium(folder.metadata),
    totalWords: chapters.reduce((sum, c) => sum + c.wordCount, 0),
    chapters,
  };
}
