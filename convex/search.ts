import { z } from 'zod';
import type { Doc } from './_generated/dataModel';
import { SEARCH_MIN_LENGTH, SNIPPET_CLOSE, SNIPPET_OPEN, type SearchResult } from '../src/features/search/search.types';
import { kinoZodQuery } from './lib/fn';
import { lematizar } from './lib/lemas';

// La búsqueda global del Cmd+K: tareas y páginas por lemas, sistemas por
// nombre. El fragmento se recorta en memoria alrededor de la primera palabra
// de la consulta que aparece en el cuerpo, con las marcas que el cliente pinta.

const DEFAULT_LIMIT = 8;
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

export const all = kinoZodQuery({
  args: { q: z.string().optional(), limit: z.number().int().min(1).max(20).optional() },
  handler: async (ctx, { q, limit = DEFAULT_LIMIT }): Promise<SearchResult[]> => {
    const term = (q ?? '').trim();
    if (term.length < SEARCH_MIN_LENGTH) return [];
    const lemas = lematizar(term);
    if (!lemas) return [];
    const userId = ctx.user._id;

    const [tasks, pages, systems] = await Promise.all([
      ctx.db
        .query('tasks')
        .withSearchIndex('search_lemas', (s) => s.search('lemas', lemas).eq('userId', userId).eq('deletedAt', undefined))
        .take(limit),
      ctx.db
        .query('pages')
        .withSearchIndex('search_lemas', (s) => s.search('lemas', lemas).eq('userId', userId).eq('deletedAt', undefined))
        .take(limit),
      ctx.db.query('systems').withIndex('by_user_active', (s) => s.eq('userId', userId).eq('isActive', true)).collect(),
    ]);
    const needle = term.toLowerCase();
    return [
      ...tasks.map((t: Doc<'tasks'>): SearchResult => ({ type: 'task', id: t._id, title: t.title, systemId: t.systemId, snippet: snippetFor(t.description ?? '', term) })),
      ...pages.map((p: Doc<'pages'>): SearchResult => ({ type: 'page', id: p._id, title: p.title ?? 'Sin título', systemId: p.systemId ?? null, snippet: snippetFor(p.content ?? '', term) })),
      ...systems
        .filter((s) => s.name.toLowerCase().includes(needle))
        .slice(0, limit)
        .map((s): SearchResult => ({ type: 'system', id: s._id, title: s.name, systemId: s._id, snippet: null })),
    ];
  },
});
