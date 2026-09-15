import { Migrations } from '@convex-dev/migrations';
import { components, internal } from '../_generated/api';
import type { DataModel, Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';

// ════════════════════════════════════════════════════════════════════════════
// Anclas huérfanas
// ════════════════════════════════════════════════════════════════════════════
//
// Retira de los documentos las marcas `data-anchor-id` que no sostienen
// ninguna nota viva. Hasta ahora nada las retiraba: cancelar el creador dejaba
// una, y borrar una nota dejaba las suyas, así que una página de pruebas
// acumuló once marcas con cero notas en seis corridas. Desde el ticket
// anterior ya no se crean más; esta migración limpia las que quedaron.
//
// ── Qué toca, documento por documento ──────────────────────────────────────
//
//   pages.content   ← el mismo HTML sin los `<span data-anchor-id="…">` cuyo
//                     id no tiene nota viva. Se quita el span y se deja su
//                     contenido: el texto no se toca nunca.
//
// Las dos clases de ancla se van igual. Una de anotación huérfana resalta una
// frase que ya nadie comenta; una de posición huérfana no pinta nada pero
// tampoco sostiene nada, porque su nota no existe. Una nota viva conserva la
// suya sea de la clase que sea.
//
// Una nota en la papelera no cuenta como viva: su marca se fue al borrarla y
// vuelve sola al restaurarla, buscando su frase (`AnchorBridge`).
//
// Las páginas borradas se saltan. Sus notas cayeron con ellas y volverán con
// ellas, así que sus marcas no son huérfanas: están esperando. Además nadie
// las está viendo.
//
// ── Idempotencia ───────────────────────────────────────────────────────────
// Una página sin `data-anchor-id` no se lee siquiera, y una cuyas marcas están
// todas vivas no se escribe. La segunda pasada no encuentra nada que quitar y
// no toca ningún documento.
//
// ── Cómo se corre ──────────────────────────────────────────────────────────
//   npx convex run migrations/anclasHuerfanas:run
// o la suelta, que es la misma:
//   npx convex run migrations/anclasHuerfanas:paginas

export const migrations = new Migrations<DataModel>(components.migrations);

/**
 * Quita del HTML los `<span>` de ancla cuyo id no está en `vivas`, dejando
 * dentro lo que llevaban.
 *
 * Lleva una pila de los `<span>` abiertos para saber a cuál cierra cada
 * `</span>`: una marca puede envolver otra etiqueta, y dos anclas distintas
 * pueden solaparse sobre el mismo texto. Un `</span>` sin pareja se conserva,
 * que es lo único seguro que se puede hacer con él.
 */
export function quitarAnclas(
  html: string,
  vivas: ReadonlySet<string>
): { html: string; retiradas: number } {
  const abiertos: boolean[] = [];
  const etiquetas = /<(\/)?span\b([^>]*)>/gi;
  let salida = '';
  let copiadoHasta = 0;
  let retiradas = 0;

  for (let etiqueta = etiquetas.exec(html); etiqueta !== null; etiqueta = etiquetas.exec(html)) {
    const esCierre = etiqueta[1] === '/';
    let seVa: boolean;
    if (esCierre) {
      seVa = abiertos.pop() ?? false;
    } else {
      const id = /\bdata-anchor-id="([^"]*)"/i.exec(etiqueta[2] ?? '')?.[1];
      seVa = id !== undefined && !vivas.has(id);
      if (seVa) retiradas += 1;
      abiertos.push(seVa);
    }
    if (!seVa) continue;
    salida += html.slice(copiadoHasta, etiqueta.index);
    copiadoHasta = etiqueta.index + etiqueta[0].length;
  }

  salida += html.slice(copiadoHasta);
  return { html: salida, retiradas };
}

/** Los `anchorId` que todavía sostiene una nota viva de esa página. */
export async function anclasVivasDe(ctx: MutationCtx, pageId: Id<'pages'>): Promise<Set<string>> {
  const notas = await ctx.db
    .query('stickyNotes')
    .withIndex('by_page', (q) => q.eq('pageId', pageId))
    .collect();
  const vivas = new Set<string>();
  for (const nota of notas) {
    if (nota.deletedAt === undefined && nota.anchorId) vivas.add(nota.anchorId);
  }
  return vivas;
}

/** Lo que la migración le hace a una página. Devuelve el parche, o nada. */
export async function limpiarPagina(
  ctx: MutationCtx,
  doc: Doc<'pages'>
): Promise<{ content: string } | undefined> {
  if (doc.deletedAt !== undefined) return;
  if (!doc.content?.includes('data-anchor-id')) return;
  const { html, retiradas } = quitarAnclas(doc.content, await anclasVivasDe(ctx, doc._id));
  if (retiradas === 0) return;
  return { content: html };
}

export const paginas = migrations.define({ table: 'pages', migrateOne: limpiarPagina });

export const run = migrations.runner([internal.migrations.anclasHuerfanas.paginas]);
