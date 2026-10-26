import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import { invalid, notFound } from './lib/errors';
import { kinoZodMutation } from './lib/fn';
import { readWorkdir, WORKDIR_PATH_MAX, WORKDIR_REMOTE_MAX, WORKDIR_RULES_MAX } from './lib/workdir';

/**
 * Guarda a qué sistema va una carpeta o un repo. Lo llama el agente después de
 * que la persona le dijo a dónde va lo de esa carpeta y aceptó guardarlo.
 * Escribir otra vez la misma carpeta cambia su sistema en vez de duplicarla.
 *
 * Recibe una sola de las dos claves: el repo cuando la carpeta es un repo con
 * remoto, para que la regla valga en todos sus clones, y la carpeta si no.
 */
export const save = kinoZodMutation({
  args: z
    .object({
      systemId: zid('systems'),
      workingDirectory: z.string().max(WORKDIR_PATH_MAX).optional(),
      gitRemote: z.string().max(WORKDIR_REMOTE_MAX).optional(),
    })
    .refine((a) => (a.workingDirectory === undefined) !== (a.gitRemote === undefined), {
      message: 'Manda workingDirectory o gitRemote, uno de los dos',
    }),
  handler: async (ctx, { systemId, ...input }) => {
    const userId = ctx.user._id;
    const system = await ctx.db.get(systemId);
    if (!system || system.userId !== userId || !system.isActive) notFound('System not found');

    const workdir = readWorkdir(input);
    // Un remoto que Kino no sabe leer no deja clave que guardar: que guarde la carpeta.
    if (!workdir.repo && !workdir.path) invalid('Kino no sabe leer ese gitRemote; guarda la regla por workingDirectory');
    const [kind, key] = workdir.repo ? (['repo', workdir.repo] as const) : (['path', workdir.path!] as const);
    const now = Date.now();

    const existing = await ctx.db
      .query('workdirRules')
      .withIndex('by_user_kind_key', (q) => q.eq('userId', userId).eq('kind', kind).eq('key', key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { systemId, updatedAt: now });
    } else {
      // Acotada por el techo que esta misma mutación impone.
      const count = (await ctx.db.query('workdirRules').withIndex('by_user_kind_key', (q) => q.eq('userId', userId)).take(WORKDIR_RULES_MAX)).length;
      if (count >= WORKDIR_RULES_MAX) invalid(`Ya hay ${WORKDIR_RULES_MAX} carpetas con sistema asignado; no caben más`);
      await ctx.db.insert('workdirRules', { userId, kind, key, systemId, createdBy: userId, createdVia: ctx.channel, createdAt: now, updatedAt: now });
    }
    return { kind, key, systemId, systemName: system.name, replaced: existing !== null };
  },
});
