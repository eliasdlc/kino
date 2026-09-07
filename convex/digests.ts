import { v } from 'convex/values';
import { z } from 'zod';
import { internalMutation, internalQuery } from './_generated/server';
import { kinoQuery } from './lib/fn';

// El diario de sesiones. Un hook determinista en el laptop de Elias lee las
// transcripciones de Claude Code y sube un digest por sesión o por semana; Kino
// no guarda nada crudo. Todo el trabajo caro (leer cientos de megabytes,
// extraer, redactar la cita) ocurre en el laptop: aquí se valida, se acota y se
// guarda, que es lo que hace que esto quepa en cero dólares al mes.
//
// La entrada vive en `convex/http.ts` y no en el conector del MCP a propósito.
// Ver ahí por qué.

/**
 * Tope de la cita, en caracteres. Una cita que no cabe en un tuit deja de ser
 * una cita y pasa a ser un extracto, y la línea del lunes es una línea. Es un
 * tope de escritura: lo ya guardado por encima se lee igual.
 */
export const DIGEST_QUOTE_MAX = 280;

/** Tope del resumen. Cabe un párrafo; lo que no cabe es la transcripción. */
export const DIGEST_SUMMARY_MAX = 2_000;

/**
 * Tope del digest entero una vez serializado. Sin él, una tool publicada agota
 * el medio giga del plan gratuito con un solo bucle de subidas. El número es el
 * que declara el comentario de `sessionDigests` en `convex/schema.ts`.
 */
export const DIGEST_BYTES_MAX = 8_192;

/**
 * Lo que el hook sube. La granularidad la decide él y no el servidor: con
 * `externalId` como id de sesión hay una fila por sesión, y con la clave de la
 * semana hay una por semana. La idempotencia se aplica sobre
 * `(userId, source, externalId)`, así que las dos formas caben sin cambiar nada
 * aquí, y reintentar una subida nunca deja una segunda fila.
 */
export const digestSchema = z.object({
  source: z.string().min(1).max(64),
  externalId: z.string().min(1).max(200),
  digest: z
    .object({
      summary: z.string().min(1).max(DIGEST_SUMMARY_MAX),
      quote: z.string().min(1).max(DIGEST_QUOTE_MAX),
      /**
       * Hash y desplazamiento del fragmento del que salió la cita. Nada en el
       * servidor puede comprobar que la frase estaba de verdad en la
       * transcripción; esto no lo hace comprobable por Kino, lo hace
       * comprobable por Elias contra su propio disco.
       */
      quoteHash: z.string().max(128).optional(),
      quoteOffset: z.number().int().min(0).optional(),
    })
    .catchall(z.unknown()),
});

export type DigestInput = z.infer<typeof digestSchema>;

/** Los bytes que ocupa un digest ya serializado. Es lo que se acota y lo que Ajustes enseña. */
export const digestBytes = (digest: unknown) => new TextEncoder().encode(JSON.stringify(digest)).length;

/**
 * Valida y guarda un digest. Interna: la única entrada es la ruta HTTP, que es
 * quien comprueba la credencial del hook antes de llegar aquí.
 *
 * Devuelve si creó la fila, para que la ruta distinga un 201 de un reintento.
 */
export const record = internalMutation({
  args: { userId: v.id('users'), source: v.string(), externalId: v.string(), digest: v.record(v.string(), v.any()) },
  returns: v.object({ created: v.boolean(), bytes: v.number() }),
  handler: async (ctx, { userId, source, externalId, digest }) => {
    const bytes = digestBytes(digest);
    const existing = await ctx.db
      .query('sessionDigests')
      .withIndex('by_user_source_external', (q) => q.eq('userId', userId).eq('source', source).eq('externalId', externalId))
      .unique();
    if (existing) return { created: false, bytes: digestBytes(existing.digest) };

    await ctx.db.insert('sessionDigests', { userId, source, externalId, digest, createdAt: Date.now() });
    return { created: true, bytes };
  },
});

/** La cuenta a la que pertenece el hook, resuelta por su correo. */
export const userByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) =>
    ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique(),
});

/** Cuántas filas enseña Ajustes. Son pocas por persona y no crecen rápido. */
const LIST_LIMIT = 20;

/**
 * Lo último que subió el hook, para que Elias pueda mirar Ajustes y ver que
 * llegó: la fecha y el tamaño de cada digest, nunca su contenido.
 */
export const list = kinoQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query('sessionDigests')
      .withIndex('by_user_created', (q) => q.eq('userId', ctx.user._id))
      .order('desc')
      .take(LIST_LIMIT);
    return rows.map((row) => ({
      id: row._id,
      source: row.source,
      externalId: row.externalId,
      createdAt: new Date(row.createdAt).toISOString(),
      bytes: digestBytes(row.digest),
    }));
  },
});
