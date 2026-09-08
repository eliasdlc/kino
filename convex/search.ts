import { z } from 'zod';
import type { Doc } from './_generated/dataModel';
import { SEARCH_MIN_LENGTH, SNIPPET_CLOSE, SNIPPET_OPEN, type SearchResult } from '../src/features/search/search.types';
import { kinoZodQuery } from './lib/fn';
import { lematizar } from './lib/lemas';

// La búsqueda global del Cmd+K sobre las cinco fuentes: tareas, capítulos y
// notas adhesivas por sus lemas, y sistemas y etiquetas por su nombre, que son
// cadenas cortas y se filtran en memoria. El fragmento se recorta alrededor de
// la primera palabra de la consulta que aparece en el cuerpo, con las marcas
// que el cliente pinta.
//
// **No hay cursor, y es una decisión.** Un cursor sobre el ranking de cinco
// fuentes no es estable: dos filas con el mismo rango pueden intercambiarse
// entre páginas y repetirse o perderse. La salida elegida es la otra que había,
// un tope duro sin paginar: cada fuente enseña sus `DEFAULT_LIMIT` primeras y
// la pantalla dice cuántas quedaron fuera. Sin páginas no hay cursor que se
// desestabilice, y dos peticiones iguales devuelven lo mismo en el mismo orden.

const DEFAULT_LIMIT = 8;

/**
 * Hasta dónde mira cada fuente para poder decir cuántos resultados quedan
 * fuera. Sin este tope, contar los que no caben obligaría a leer todas las
 * coincidencias, que es justo lo que la restricción del presupuesto prohíbe.
 * Cuando una fuente lo alcanza, la cuenta se da como «más de».
 */
const SOURCE_CAP = 50;

const SNIPPET_RADIUS = 60;

function plainText(html: string | undefined): string {
  return (html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fragmento alrededor de la primera palabra de la consulta que aparece. Sin coincidencia no hay fragmento. */
export function snippetFor(body: string, query: string): string | null {
  const text = plainText(body);
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const word of query.toLowerCase().split(/\s+/).filter((w) => w.length >= 2)) {
    const at = lower.indexOf(word);
    if (at === -1) continue;
    const start = Math.max(0, at - SNIPPET_RADIUS);
    const end = Math.min(text.length, at + word.length + SNIPPET_RADIUS);
    const prefix = start > 0 ? '… ' : '';
    const suffix = end < text.length ? ' …' : '';
    return `${prefix}${text.slice(start, at)}${SNIPPET_OPEN}${text.slice(at, at + word.length)}${SNIPPET_CLOSE}${text.slice(at + word.length, end)}${suffix}`;
  }
  return null;
}

/** Lo que una fuente aporta: lo que cabe, y cuántos vio de más. */
function recortar<T>(encontrados: T[], limit: number) {
  return { items: encontrados.slice(0, limit), sobran: Math.max(0, encontrados.length - limit) };
}

export const all = kinoZodQuery({
  args: { q: z.string().optional(), limit: z.number().int().min(1).max(20).optional() },
  handler: async (ctx, { q, limit = DEFAULT_LIMIT }) => {
    const term = (q ?? '').trim();
    const vacio = { items: [] as SearchResult[], restantes: 0, tope: false };
    if (term.length < SEARCH_MIN_LENGTH) return vacio;
    const lemas = lematizar(term);
    if (!lemas) return vacio;
    const userId = ctx.user._id;
    const needle = term.toLowerCase();

    const [tasks, pages, notes, systems, tags] = await Promise.all([
      ctx.db
        .query('tasks')
        .withSearchIndex('search_lemas', (s) => s.search('lemas', lemas).eq('userId', userId).eq('deletedAt', undefined))
        .take(SOURCE_CAP),
      ctx.db
        .query('pages')
        .withSearchIndex('search_lemas', (s) => s.search('lemas', lemas).eq('userId', userId).eq('deletedAt', undefined))
        .take(SOURCE_CAP),
      ctx.db
        .query('stickyNotes')
        .withSearchIndex('search_lemas', (s) => s.search('lemas', lemas).eq('userId', userId).eq('deletedAt', undefined))
        .take(SOURCE_CAP),
      ctx.db.query('systems').withIndex('by_user_active', (s) => s.eq('userId', userId).eq('isActive', true)).collect(),
      ctx.db.query('contextTags').withIndex('by_user', (s) => s.eq('userId', userId)).collect(),
    ]);

    const fuentes = [
      recortar(
        tasks.map((t: Doc<'tasks'>): SearchResult => ({
          type: 'task', id: t._id, title: t.title, systemId: t.systemId,
          href: `/systems/${t.systemId}`, snippet: snippetFor(t.description ?? '', term),
        })),
        limit,
      ),
      recortar(
        pages.flatMap((p: Doc<'pages'>): SearchResult[] =>
          p.systemId === undefined
            ? []
            : [{
                type: 'page', id: p._id, title: p.title ?? 'Sin título', systemId: p.systemId,
                href: `/systems/${p.systemId}/pages/${p._id}`, snippet: snippetFor(p.content ?? '', term),
              }],
        ),
        limit,
      ),
      recortar(notes.flatMap((n: Doc<'stickyNotes'>): SearchResult[] => noteResult(n, term)), limit),
      recortar(
        tags
          .filter((t) => t.title.toLowerCase().includes(needle))
          .map((t): SearchResult => ({
            type: 'tag', id: t._id, title: t.title, systemId: t.systemId ?? null,
            href: `/tasks?tag=${t._id}`, snippet: null,
          })),
        limit,
      ),
      recortar(
        systems
          .filter((s) => s.name.toLowerCase().includes(needle))
          .map((s): SearchResult => ({ type: 'system', id: s._id, title: s.name, systemId: s._id, href: `/systems/${s._id}`, snippet: null })),
        limit,
      ),
    ];

    return {
      items: fuentes.flatMap((f) => f.items),
      /** Cuántos resultados quedaron fuera del tope, sumando las cinco fuentes. */
      restantes: fuentes.reduce((total, f) => total + f.sobran, 0),
      /** Alguna fuente llegó al techo de lo que se mira: `restantes` se queda corto. */
      tope: [tasks, pages, notes].some((docs) => docs.length === SOURCE_CAP),
    };
  },
});

/** Una nota vive en un capítulo o en una carpeta, y ahí es donde lleva su resultado. */
function noteResult(doc: Doc<'stickyNotes'>, term: string): SearchResult[] {
  const cuerpo = doc.content ?? doc.textAnchor ?? '';
  const destino = doc.systemId === undefined
    ? null
    : doc.pageId
      ? `/systems/${doc.systemId}/pages/${doc.pageId}`
      : doc.folderId
        ? `/systems/${doc.systemId}/folders/${doc.folderId}`
        : null;
  if (destino === null) return [];
  return [{
    type: 'note',
    id: doc._id,
    title: doc.title ?? (plainText(cuerpo).slice(0, 80) || 'Nota sin texto'),
    systemId: doc.systemId ?? null,
    href: destino,
    snippet: snippetFor(cuerpo, term),
  }];
}
