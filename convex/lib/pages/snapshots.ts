import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx } from '../../_generated/server';
import { countWords } from '../../../src/shared/lib/word-count';
import { MAX_SNAPSHOTS_PER_PAGE } from '../../../src/features/writing/snapshots';

// Las versiones de un capítulo. Viven con `pages` y no con `writing` porque el
// soporte del deshacer es de los siete arquetipos, no sólo del de escritura: un
// agente que reescribe el cuerpo de una nota de proyecto necesita la misma red
// que uno que reescribe un capítulo de novela.
//
// El slice de escritura sigue leyéndolas para su panel de historial, y las
// escribe cuando la persona vuelve a una versión anterior. Lo que ya no hace es
// ser el único sitio donde se saben escribir.

/**
 * Guarda cómo estaba el capítulo antes de un cambio. Un texto en blanco o
 * idéntico a la última versión no genera otra; sobreviven las últimas
 * `MAX_SNAPSHOTS_PER_PAGE`.
 *
 * Devuelve el id de la versión que escribió, o `undefined` si no escribió
 * ninguna. Es lo que el evento de la edición guarda en `snapshotId`, porque un
 * capítulo de veinte mil caracteres no cabe en un payload de 2.048 bytes.
 */
export async function archivarVersion(
  ctx: MutationCtx,
  page: Doc<'pages'>,
  content: string | undefined,
  sessionStartedAt: number | undefined,
): Promise<Id<'pageSnapshots'> | undefined> {
  if (!content || content.trim() === '') return undefined;
  const existing = (await ctx.db.query('pageSnapshots').withIndex('by_page_created', (q) => q.eq('pageId', page._id)).collect()).sort(
    (a, b) => b.createdAt - a.createdAt,
  );
  if (existing[0]?.content === content) return undefined;
  const id = await ctx.db.insert('pageSnapshots', {
    pageId: page._id,
    userId: page.userId,
    systemId: page.systemId,
    content,
    wordCount: countWords(content),
    sessionStartedAt,
    createdAt: Date.now(),
  });
  for (const old of existing.slice(MAX_SNAPSHOTS_PER_PAGE - 1)) await ctx.db.delete(old._id);
  return id;
}
