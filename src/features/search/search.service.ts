import { db } from "@/shared/db";
import { tasks, pages, systems } from "@/shared/db/schema";
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { SEARCH_MIN_LENGTH, toLikePattern, type SearchResult } from "./search.types";

const DEFAULT_LIMIT = 8;

/**
 * Búsqueda global por `ILIKE` sobre tareas, páginas y sistemas del usuario.
 * Suficiente al volumen actual; el upgrade a `tsvector` (Sprint 3 del plan)
 * queda para cuando el volumen lo pida.
 */
export async function searchAll(
  userId: string,
  q: string,
  limit = DEFAULT_LIMIT,
): Promise<SearchResult[]> {
  const term = q.trim();
  if (term.length < SEARCH_MIN_LENGTH) return [];

  const pattern = toLikePattern(term);

  const [taskRows, pageRows, systemRows] = await Promise.all([
    db
      .select({ id: tasks.id, title: tasks.title, systemId: tasks.systemId })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          isNull(tasks.deletedAt),
          or(ilike(tasks.title, pattern), ilike(tasks.description, pattern)),
        ),
      )
      .limit(limit),
    db
      .select({ id: pages.id, title: pages.title, systemId: pages.systemId })
      .from(pages)
      .where(
        and(
          eq(pages.userId, userId),
          isNull(pages.deletedAt),
          ilike(pages.title, pattern),
        ),
      )
      .limit(limit),
    db
      .select({ id: systems.id, name: systems.name })
      .from(systems)
      .where(and(eq(systems.userId, userId), ilike(systems.name, pattern)))
      .limit(limit),
  ]);

  return [
    ...taskRows.map((t): SearchResult => ({
      type: "task",
      id: t.id,
      title: t.title,
      systemId: t.systemId,
    })),
    ...pageRows.map((p): SearchResult => ({
      type: "page",
      id: p.id,
      title: p.title ?? "Sin título",
      systemId: p.systemId,
    })),
    ...systemRows.map((s): SearchResult => ({
      type: "system",
      id: s.id,
      title: s.name,
      systemId: s.id,
    })),
  ];
}
