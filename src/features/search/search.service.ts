import { db } from "@/shared/db";
import { tasks, pages, systems } from "@/shared/db/schema";
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import {
  SEARCH_MIN_LENGTH,
  SNIPPET_CLOSE,
  SNIPPET_OPEN,
  toTsQueryText,
  type SearchResult,
} from "./search.types";

const DEFAULT_LIMIT = 8;

/**
 * Configuración de búsqueda creada en `drizzle/0015_busqueda_full_text.sql`:
 * `spanish` más el diccionario `unaccent`, para que la derivación de raíces y
 * los acentos funcionen a la vez. Debe ser la misma con la que se generó la
 * columna `search_vector`; si divergen, el índice deja de servir.
 */
const TS_CONFIG = sql`'public.spanish_unaccent'`;

/**
 * Limpieza de HTML idéntica a la de la columna generada de `pages`. Se repite
 * aquí porque `ts_headline` necesita el documento original para recortar el
 * fragmento, y pasarle el HTML crudo devolvería etiquetas dentro del extracto.
 * Si se cambia una, hay que cambiar la otra.
 */
const PAGE_PLAIN_TEXT = sql`regexp_replace(regexp_replace(coalesce(${pages.content}, ''), '<[^>]*>', ' ', 'g'), '&(nbsp|amp|lt|gt|quot|apos|#39);', ' ', 'g')`;

const HEADLINE_OPTIONS = `StartSel=${SNIPPET_OPEN}, StopSel=${SNIPPET_CLOSE}, MaxWords=18, MinWords=6, MaxFragments=1, FragmentDelimiter= … `;

function headline(document: SQL, query: SQL): SQL<string> {
  return sql<string>`ts_headline(${TS_CONFIG}, ${document}, ${query}, ${HEADLINE_OPTIONS})`;
}

/**
 * `ts_headline` devuelve el arranque del documento cuando no hay coincidencia
 * dentro de él — el caso de una tarea que casó sólo por el título. Ese texto no
 * explica nada, así que se descarta: sin marca de resaltado no hay fragmento.
 */
function usableSnippet(raw: string | null): string | null {
  if (!raw) return null;
  return raw.includes(SNIPPET_OPEN) ? raw : null;
}

/**
 * Búsqueda global full-text sobre tareas, páginas y sistemas del usuario.
 *
 * Tareas y páginas resuelven contra la columna generada `search_vector` y su
 * índice GIN, ordenando por `ts_rank` — con el título en peso `A` y el cuerpo en
 * `B`, una coincidencia en el título gana a una en el párrafo 40. Los sistemas
 * se calculan al vuelo: sólo tienen `name`, y son unas decenas de filas por
 * usuario, así que un índice propio no se paga.
 */
export async function searchAll(
  userId: string,
  q: string,
  limit = DEFAULT_LIMIT,
): Promise<SearchResult[]> {
  const term = q.trim();
  if (term.length < SEARCH_MIN_LENGTH) return [];

  const queryText = toTsQueryText(term);
  // Un término sin letras ni dígitos ("!!!") no deja nada que buscar, y
  // `to_tsquery('')` es un error en Postgres, no una consulta vacía.
  if (queryText.length === 0) return [];

  const tsQuery = sql`to_tsquery(${TS_CONFIG}, ${queryText})`;
  const taskRank = sql<number>`ts_rank(${tasks}.search_vector, ${tsQuery})`;
  const pageRank = sql<number>`ts_rank(${pages}.search_vector, ${tsQuery})`;
  const systemVector = sql`to_tsvector(${TS_CONFIG}, ${systems.name})`;

  const [taskRows, pageRows, systemRows] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        systemId: tasks.systemId,
        snippet: headline(sql`coalesce(${tasks.description}, '')`, tsQuery),
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          isNull(tasks.deletedAt),
          sql`${tasks}.search_vector @@ ${tsQuery}`,
        ),
      )
      .orderBy(desc(taskRank))
      .limit(limit),
    db
      .select({
        id: pages.id,
        title: pages.title,
        systemId: pages.systemId,
        snippet: headline(PAGE_PLAIN_TEXT, tsQuery),
      })
      .from(pages)
      .where(
        and(
          eq(pages.userId, userId),
          isNull(pages.deletedAt),
          sql`${pages}.search_vector @@ ${tsQuery}`,
        ),
      )
      .orderBy(desc(pageRank))
      .limit(limit),
    db
      .select({ id: systems.id, name: systems.name })
      .from(systems)
      .where(and(eq(systems.userId, userId), sql`${systemVector} @@ ${tsQuery}`))
      .limit(limit),
  ]);

  return [
    ...taskRows.map((t): SearchResult => ({
      type: "task",
      id: t.id,
      title: t.title,
      systemId: t.systemId,
      snippet: usableSnippet(t.snippet),
    })),
    ...pageRows.map((p): SearchResult => ({
      type: "page",
      id: p.id,
      title: p.title ?? "Sin título",
      systemId: p.systemId,
      snippet: usableSnippet(p.snippet),
    })),
    ...systemRows.map((s): SearchResult => ({
      type: "system",
      id: s.id,
      title: s.name,
      systemId: s.id,
      snippet: null,
    })),
  ];
}
