import { z } from 'zod';
import { kinoZodMutation, kinoZodQuery } from './lib/fn';
import type { Id } from './_generated/dataModel';
import type { QueryCtx, MutationCtx } from './_generated/server';
import { repoRefOf } from './githubData';

// Las fuentes conectadas. Hoy hay una, GitHub, y este slice existe para que la
// segunda no obligue a reescribir la primera: una conexión cifrada más un
// refresco idempotente que nunca pisa lo que Kino añadió encima.

/**
 * Los proveedores que de verdad tienen código detrás.
 *
 * `syncConnections.provider` admite siete valores porque el schema de Postgres
 * los sembró como intención de futuro, y sólo `github` llegó a escribirse. Un
 * control que ofrece Jira o Slack y no responde es un control muerto, así que
 * la entrada se acota aquí y los seis restantes se rechazan con este motivo.
 *
 * Los seis valores se quedan en la unión del schema: no hay ninguna fila con
 * ellos, quitarlos no ahorra nada, y volver a añadir uno el día que tenga
 * código sería otra vez un cambio de schema.
 */
export const PROVEEDORES_VIVOS = ['github'] as const;
export type ProveedorVivo = (typeof PROVEEDORES_VIVOS)[number];

/** El validador de entrada. Cualquier otro proveedor es un error de validación. */
export const proveedorVivo = z.enum(PROVEEDORES_VIVOS, {
  message: `Sólo ${PROVEEDORES_VIVOS.join(', ')} tiene código de sincronización. Los demás valores existen en el schema y no responden.`,
});

async function conexionDe(ctx: QueryCtx | MutationCtx, userId: Id<'users'>, provider: ProveedorVivo) {
  return ctx.db
    .query('syncConnections')
    .withIndex('by_user_provider', (q) => q.eq('userId', userId).eq('provider', provider))
    .unique();
}

/**
 * Las fuentes que se pueden conectar, con el estado de cada una. Devuelve una
 * entrada por proveedor vivo, conectado o no: es la lista que Ajustes pinta, y
 * si sólo devolviera las conectadas no habría dónde conectar la primera.
 */
export const list = kinoZodQuery({
  args: {},
  handler: async (ctx) => {
    const sistemas = await ctx.db
      .query('systems')
      .withIndex('by_user_active', (q) => q.eq('userId', ctx.user._id))
      .collect();
    const enlazados = sistemas.filter((sistema) => repoRefOf(sistema) !== null).length;

    return Promise.all(
      PROVEEDORES_VIVOS.map(async (provider) => {
        const fila = await conexionDe(ctx, ctx.user._id, provider);
        return {
          provider,
          connected: fila !== null,
          lastSyncedAt: fila?.lastSyncedAt === undefined ? null : new Date(fila.lastSyncedAt).toISOString(),
          syncedThrough: fila?.syncedThrough === undefined ? null : new Date(fila.syncedThrough).toISOString(),
          linkedSystems: provider === 'github' ? enlazados : 0,
        };
      }),
    );
  },
});

/**
 * Olvida la conexión de una fuente. El token cifrado se va con la fila; lo que
 * ya se importó se queda, porque son tareas del usuario y no copias del
 * proveedor.
 */
export const forget = kinoZodMutation({
  args: { provider: proveedorVivo },
  handler: async (ctx, { provider }) => {
    const fila = await conexionDe(ctx, ctx.user._id, provider);
    if (fila) await ctx.db.delete(fila._id);
    return null;
  },
});
