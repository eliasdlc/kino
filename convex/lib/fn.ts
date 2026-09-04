import { ConvexError } from 'convex/values';
import { customAction, customCtx, customMutation, customQuery } from 'convex-helpers/server/customFunctions';
import { zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4';
import type { Auth, GenericDatabaseReader, GenericDatabaseWriter, UserIdentity } from 'convex/server';
import { action, mutation, query, type ActionCtx, type MutationCtx, type QueryCtx } from '../_generated/server';
import type { DataModel, Doc } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import { allows, isScope, type Scope } from './scopes';

// De aquí salen todas las funciones públicas de Kino. Cada una nace con la
// identidad de Clerk ya resuelta, el documento `users` cargado y el alcance del
// cliente comprobado antes de leer nada. Las funciones internas (crons,
// importador) no pasan por aquí: no las llama nadie con identidad.

/** Errores tipados que el cliente puede distinguir. */
export type FnErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN_SCOPE' | 'NO_USER' | 'BUDGET_EXCEEDED';

function fail(code: FnErrorCode, extra: Record<string, unknown> = {}): never {
  throw new ConvexError({ code, ...extra });
}

/** Lo que el envoltorio deja en el contexto de cada función. */
export type Caller = {
  user: Doc<'users'>;
  clerkId: string;
  /** Alcance efectivo de quien llama; `write` para el dueño. */
  scope: Scope;
};

/**
 * Identidad y alcance, sin tocar la base: un cliente sin permiso se rechaza
 * antes de la primera lectura.
 */
async function authorize(auth: Auth, required: Scope): Promise<{ identity: UserIdentity; scope: Scope }> {
  const identity = await auth.getUserIdentity();
  if (!identity) fail('UNAUTHENTICATED');
  const claimed = identity.kino_scope;
  const scope: Scope = claimed === undefined ? 'write' : isScope(claimed) ? claimed : 'read';
  if (!allows(scope, required)) fail('FORBIDDEN_SCOPE', { required, granted: scope });
  return { identity, scope };
}

function findUser(db: GenericDatabaseReader<DataModel>, clerkId: string) {
  return db
    .query('users')
    .withIndex('by_clerkId', (q) => q.eq('clerkId', clerkId))
    .unique();
}

/**
 * El documento `users` de una identidad, creándolo si es la primera vez. Un
 * usuario importado de Postgres existe por correo pero sin `clerkId`: la
 * primera sesión lo enlaza en vez de duplicarlo.
 */
export async function ensureUser(db: GenericDatabaseWriter<DataModel>, identity: UserIdentity): Promise<Doc<'users'>> {
  const linked = await findUser(db, identity.subject);
  if (linked) return linked;

  const email = identity.email;
  if (!email) fail('NO_USER', { reason: 'EMAIL_REQUIRED' });
  const now = Date.now();

  const imported = await db
    .query('users')
    .withIndex('by_email', (q) => q.eq('email', email))
    .unique();
  if (imported) {
    await db.patch(imported._id, { clerkId: identity.subject, updatedAt: now });
    return { ...imported, clerkId: identity.subject, updatedAt: now };
  }

  const id = await db.insert('users', {
    clerkId: identity.subject,
    email,
    name: identity.name ?? email.split('@')[0],
    image: identity.pictureUrl,
    onboardingCompleted: false,
    status: 'active',
    timezone: 'America/Santo_Domingo',
    createdAt: now,
    updatedAt: now,
  });
  return (await db.get(id))!;
}

async function callerForQuery(ctx: QueryCtx, required: Scope): Promise<Caller> {
  const { identity, scope } = await authorize(ctx.auth, required);
  const user = await findUser(ctx.db, identity.subject);
  if (!user) fail('NO_USER');
  return { user, clerkId: identity.subject, scope };
}

async function callerForMutation(ctx: MutationCtx, required: Scope): Promise<Caller> {
  const { identity, scope } = await authorize(ctx.auth, required);
  const user = await ensureUser(ctx.db, identity);
  return { user, clerkId: identity.subject, scope };
}

/** Lectura. Exige `read`. */
export const kinoQuery = customQuery(
  query,
  customCtx(async (ctx) => callerForQuery(ctx, 'read')),
);

/** Escritura directa. Exige `write`; crea el documento `users` si falta. */
export const kinoMutation = customMutation(
  mutation,
  customCtx(async (ctx) => callerForMutation(ctx, 'write')),
);

/** Escritura que sólo propone: un agente con `propose` llega, uno con `read` no. */
export const kinoProposal = customMutation(
  mutation,
  customCtx(async (ctx) => callerForMutation(ctx, 'propose')),
);

// Las mismas tres puertas con argumentos en Zod, para los slices cuyo contrato
// ya es un schema de Zod con refinamientos que `v` no sabe expresar. La
// identidad y el alcance se resuelven igual: cambia sólo cómo se validan los
// argumentos.

export const kinoZodQuery = zCustomQuery(
  query,
  customCtx(async (ctx) => callerForQuery(ctx, 'read')),
);

export const kinoZodMutation = zCustomMutation(
  mutation,
  customCtx(async (ctx) => callerForMutation(ctx, 'write')),
);

export const kinoZodProposal = zCustomMutation(
  mutation,
  customCtx(async (ctx) => callerForMutation(ctx, 'propose')),
);

/** Lo que una acción recibe para no pasarse de su presupuesto. */
export type Budget = {
  budgetMs: number;
  /** Lo que queda desde que arrancó la acción. */
  remainingMs(): number;
  /** `fetch` que aborta al agotarse el presupuesto. */
  fetch(input: string | URL, init?: RequestInit): Promise<Response>;
};

function budgetFrom(budgetMs: number): Budget {
  const startedAt = Date.now();
  const remainingMs = () => Math.max(0, budgetMs - (Date.now() - startedAt));
  return {
    budgetMs,
    remainingMs,
    async fetch(input, init) {
      const remaining = remainingMs();
      if (remaining === 0) fail('BUDGET_EXCEEDED', { budgetMs });
      try {
        return await fetch(input, { ...init, signal: AbortSignal.timeout(remaining) });
      } catch (error) {
        if (error instanceof Error && error.name === 'TimeoutError') fail('BUDGET_EXCEEDED', { budgetMs });
        throw error;
      }
    },
  };
}

/**
 * Acción, que es lo único que llama fuera. El presupuesto es obligatorio y
 * queda escrito en la definición: `kinoAction(5_000)({ ... })`. Exige `write`,
 * porque una acción sin escritura sería una query.
 */
export const kinoAction = (budgetMs: number) =>
  customAction(
    action,
    customCtx(async (ctx: ActionCtx) => {
      const { identity, scope } = await authorize(ctx.auth, 'write');
      // Anotado a mano: el tipo de `internal` depende de todos los módulos,
      // este incluido, y sin la anotación el compilador entra en bucle.
      const user: Doc<'users'> | null = await ctx.runQuery(internal.users.byClerkId, {
        clerkId: identity.subject,
      });
      if (!user) fail('NO_USER');
      const caller: Caller & { budget: Budget } = {
        user,
        clerkId: identity.subject,
        scope,
        budget: budgetFrom(budgetMs),
      };
      return caller;
    }),
  );
