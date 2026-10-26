import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import type { Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { invalid, notFound } from './errors';
import { readWorkdir, resolveWorkdir, WORKDIR_PATH_MAX, WORKDIR_REMOTE_MAX } from './workdir';

/** Lo que un agente manda para que Kino decida el sistema: nombrarlo, la carpeta o el repo. */
export interface AgentRoute {
  systemId?: Id<'systems'>;
  workingDirectory?: string;
  gitRemote?: string;
}

export const agentRouteFields = {
  systemId: zid('systems').optional(),
  workingDirectory: z.string().max(WORKDIR_PATH_MAX).optional(),
  gitRemote: z.string().max(WORKDIR_REMOTE_MAX).optional(),
};

/**
 * El sistema de la tarea madre de quien la pide. La subtarea vive donde vive su
 * madre; una madre ajena, borrada o inexistente es la misma respuesta que da
 * `createOne`, para no revelar tareas de otra persona.
 */
export async function parentSystem(ctx: QueryCtx, userId: Id<'users'>, parentTaskId: Id<'tasks'>): Promise<Id<'systems'>> {
  const parent = await ctx.db.get(parentTaskId);
  if (!parent || parent.userId !== userId || parent.deletedAt !== undefined) notFound('Parent task not found');
  return parent.systemId;
}

/**
 * A qué sistema va lo que el conector crea sin saber el sistema. Decide en este
 * orden: el `systemId` que el agente pasó; la madre, si crea una subtarea
 * (`parentTaskId`), porque una subtarea no se separa de su madre ni por una
 * regla de carpeta; la regla de su carpeta o su repo (`workdir.ts`); si mandó
 * carpeta y ninguna regla la cubre, `needs_system` para que el agente pregunte;
 * y sin carpeta ni sistema, la Bandeja. Lo comparten las tareas (una y por
 * lote) y las páginas, para que las herramientas no puedan discrepar.
 */
export async function routeAgentCreate(
  ctx: QueryCtx,
  userId: Id<'users'>,
  { systemId, workingDirectory, gitRemote, parentTaskId }: AgentRoute & { parentTaskId?: Id<'tasks'> },
) {
  if (systemId) return { status: 'routed' as const, routedBy: 'systemId' as const, systemId };
  if (parentTaskId) return { status: 'routed' as const, routedBy: 'parent' as const, systemId: await parentSystem(ctx, userId, parentTaskId) };

  const workdir = readWorkdir({ workingDirectory, gitRemote });
  if (workdir.path || workdir.repo) {
    const match = await resolveWorkdir(ctx, userId, workdir);
    if (!match) return { status: 'needs_system' as const, workingDirectory: workdir.path ?? null, gitRemote: workdir.repo ?? null };
    return {
      status: 'routed' as const,
      routedBy: 'rule' as const,
      rule: { kind: match.rule.kind, key: match.rule.key, systemName: match.system.name },
      systemId: match.system._id,
    };
  }

  const inbox = await ctx.db
    .query('systems')
    .withIndex('by_user_inbox', (q) => q.eq('userId', userId).eq('isInbox', true))
    .first();
  if (!inbox || !inbox.isActive) invalid('Falta systemId y esta cuenta no tiene Bandeja');
  return { status: 'routed' as const, routedBy: 'inbox' as const, systemId: inbox._id };
}
