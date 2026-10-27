import { v } from 'convex/values';
import { internalQuery } from './_generated/server';
import { kinoClosed, kinoQuery, kinoServicio } from './lib/fn';
import { notFound } from './lib/errors';
import {
  clienteConocido,
  MCP_CLIENTS_ACTIVE_CAP,
  MCP_CLIENTS_REVOCADOS_VISIBLES,
  MCP_CLIENTS_SUBJECT,
  REGISTRAR_CADA_MS,
  SIN_NOMBRE,
} from './lib/mcpClients';

// Los clientes del conector que ya llamaron a Kino con esta cuenta. La ruta
// `/api/mcp` los registra en cada petición autorizada, el envoltorio de
// `lib/fn.ts` corta a los revocados en cada llamada que llega por el conector,
// y Ajustes > Agentes los lista y los desconecta.

const alcance = v.union(v.literal('read'), v.literal('propose'), v.literal('write'));

/**
 * Anota que `clientId` llamó, y dice si la persona ya lo desconectó. La ruta
 * lo llama antes de montar el servidor, así que un cliente revocado nunca
 * llega a ejecutar una tool.
 *
 * Escribe como mucho una vez por cliente cada `REGISTRAR_CADA_MS`: la primera
 * llamada inserta, y las siguientes solo parchean cuando pasó ese tiempo, el
 * alcance cambió o el cliente por fin dijo su nombre. Una llamada que no
 * cambia nada no escribe nada.
 *
 * Techo de `MCP_CLIENTS_ACTIVE_CAP` activos por persona: al entrar uno nuevo
 * sobre el techo sale el más antiguo. Es seguro porque un activo borrado que
 * vuelve a llamar se inserta de nuevo como activo. Los revocados nunca se
 * borran: borrar uno dejaría a ese `clientId` volver a entrar como nuevo.
 * No hay cron, igual que en `rateLimits.ts`, porque en dev no corren.
 */
export const registrar = kinoServicio(MCP_CLIENTS_SUBJECT)({
  args: { clerkId: v.string(), clientId: v.string(), scope: alcance, clientName: v.optional(v.string()) },
  returns: v.object({ revocado: v.boolean() }),
  handler: async (ctx, { clerkId, clientId, scope, clientName }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', clerkId))
      .unique();
    // Sin onboarding terminado no hay a quién anotarle nada.
    if (!user) return { revocado: false };

    const fila = await ctx.db
      .query('mcpClients')
      .withIndex('by_user_client', (q) => q.eq('userId', user._id).eq('clientId', clientId))
      .unique();
    if (fila?.revokedAt !== undefined) return { revocado: true };

    const ahora = Date.now();
    const nombre = clientName?.trim() ? clienteConocido(clientName) : undefined;

    if (!fila) {
      // Solo los activos, los más recientes primero: el más antiguo queda al
      // final. Un revocado no entra en la cuenta ni se borra nunca.
      const activos = await ctx.db
        .query('mcpClients')
        .withIndex('by_user_revoked_lastSeen', (q) => q.eq('userId', user._id).eq('revokedAt', undefined))
        .order('desc')
        .take(MCP_CLIENTS_ACTIVE_CAP);
      const sobran = activos.length - (MCP_CLIENTS_ACTIVE_CAP - 1);
      if (sobran > 0) {
        for (const vieja of activos.slice(-sobran)) await ctx.db.delete(vieja._id);
      }
      const { kind, label } = nombre ?? clienteConocido(undefined);
      await ctx.db.insert('mcpClients', {
        userId: user._id,
        clientId,
        kind,
        label,
        scope,
        firstSeenAt: ahora,
        lastSeenAt: ahora,
      });
      return { revocado: false };
    }

    // Un cliente que se llama literalmente «Cliente sin nombre» no cuenta como
    // nombre nuevo: si contara, escribiría en cada llamada.
    const poneNombre = fila.label === SIN_NOMBRE && nombre !== undefined && nombre.label !== SIN_NOMBRE;
    if (ahora - fila.lastSeenAt >= REGISTRAR_CADA_MS || fila.scope !== scope || poneNombre) {
      await ctx.db.patch(fila._id, {
        lastSeenAt: ahora,
        scope,
        ...(poneNombre ? { kind: nombre.kind, label: nombre.label } : {}),
      });
    }
    return { revocado: false };
  },
});

/**
 * Los clientes de quien llama: activos por su última llamada, y revocados por
 * la fecha en que se cortaron. Nunca devuelve el `clientId`: la pantalla no lo
 * necesita y es el dato con el que se firma al cliente.
 */
export const list = kinoQuery({
  args: {},
  handler: async (ctx) => {
    const activos = await ctx.db
      .query('mcpClients')
      .withIndex('by_user_revoked_lastSeen', (q) => q.eq('userId', ctx.user._id).eq('revokedAt', undefined))
      .order('desc')
      // El techo de `registrar` deja como mucho este número de activos.
      .take(MCP_CLIENTS_ACTIVE_CAP);
    const revocados = await ctx.db
      .query('mcpClients')
      .withIndex('by_user_revoked_lastSeen', (q) => q.eq('userId', ctx.user._id).gt('revokedAt', 0))
      .order('desc')
      .take(MCP_CLIENTS_REVOCADOS_VISIBLES);
    const item = (c: (typeof activos)[number]) => ({
      _id: c._id,
      kind: c.kind,
      label: c.label,
      scope: c.scope,
      lastSeenAt: c.lastSeenAt,
      ...(c.revokedAt !== undefined ? { revokedAt: c.revokedAt } : {}),
    });
    return {
      activos: activos.map(item),
      revocados: revocados.map(item),
    };
  },
});

/**
 * Corta a un cliente: su próxima llamada recibe «acceso revocado». Cerrada a
 * la sesión del navegador (`kinoClosed`), así que ningún agente desconecta a
 * otro. Idempotente: desconectar a uno ya desconectado no cambia la fecha.
 */
export const desconectar = kinoClosed({
  args: { id: v.id('mcpClients') },
  handler: async (ctx, { id }) => {
    const fila = await ctx.db.get(id);
    if (!fila || fila.userId !== ctx.user._id) notFound('Ese agente no existe.');
    if (fila.revokedAt === undefined) await ctx.db.patch(id, { revokedAt: Date.now() });
  },
});

/**
 * Si `clientId` está revocado para esa persona. Es la lectura de `kinoAction`,
 * que no tiene `db`; mutaciones y queries leen el mismo índice directamente.
 */
export const revocado = internalQuery({
  args: { userId: v.id('users'), clientId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { userId, clientId }) => {
    const fila = await ctx.db
      .query('mcpClients')
      .withIndex('by_user_client', (q) => q.eq('userId', userId).eq('clientId', clientId))
      .unique();
    return fila?.revokedAt !== undefined;
  },
});
