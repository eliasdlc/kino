import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import { invalid } from './lib/errors';
import { kinoZodProposal } from './lib/fn';
import type { MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';

// Una propuesta es una escritura que el usuario todavía no ha aceptado. Aquí
// sólo vive el tope y quién la crea; quién las lista y las aplica llega en la
// fase que le da pantalla.
//
// ── Retención ──────────────────────────────────────────────────────────────
// Catorce días desde que se crea (`expiresAt`). Una propuesta caducada no se
// borra sola: cambia a `expired` cuando alguien la mira, porque el usuario
// tiene derecho a ver qué se le propuso y se le pasó. Quien la dispara es la
// pantalla de propuestas, no un cron.

/** Días que una propuesta pendiente sigue siendo aplicable. */
export const EXPIRES_IN_DAYS = 14;

/**
 * Propuestas pendientes que un usuario puede acumular. El tope existe porque
 * un agente en bucle podría llenar la bandeja hasta hacerla inservible: veinte
 * es lo que cabe en una pantalla sin que el usuario deje de leerlas.
 */
export const MAX_PENDING = 20;

/** Cuántas pendientes tiene ahora mismo. */
export async function pendingCount(ctx: MutationCtx, userId: Id<'users'>): Promise<number> {
  const rows = await ctx.db
    .query('proposals')
    .withIndex('by_user_status', (q) => q.eq('userId', userId).eq('status', 'pending'))
    .collect();
  return rows.length;
}

/**
 * Crea una propuesta. Es `kinoZodProposal` y no `kinoZodMutation` a propósito:
 * un agente con alcance `propose` llega hasta aquí y no más allá.
 */
export const create = kinoZodProposal({
  args: {
    kind: z.enum(['archive', 'cancel', 'rewrite']),
    evidenceType: z.enum(['task', 'page', 'folder', 'stickyNote', 'system', 'entity', 'sprint']),
    evidenceId: z.string().min(1).max(64),
    systemId: zid('systems').optional(),
    sourceClientId: z.string().max(255).optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
  },
  handler: async (ctx, input) => {
    const userId = ctx.user._id;
    if ((await pendingCount(ctx, userId)) >= MAX_PENDING) {
      invalid(`Ya hay ${MAX_PENDING} propuestas pendientes. Resuelve alguna antes de proponer otra.`);
    }
    const now = Date.now();
    const id = await ctx.db.insert('proposals', {
      userId,
      systemId: input.systemId,
      status: 'pending',
      kind: input.kind,
      sourceClientId: input.sourceClientId,
      evidenceType: input.evidenceType,
      evidenceId: input.evidenceId,
      payload: input.payload ?? {},
      expiresAt: now + EXPIRES_IN_DAYS * 86_400_000,
      createdAt: now,
    });
    return { id };
  },
});
