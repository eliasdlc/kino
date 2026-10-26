import { ConvexError } from 'convex/values';
import { customAction, customCtx, customMutation, customQuery } from 'convex-helpers/server/customFunctions';
import { zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4';
import type { Auth, GenericDatabaseReader, GenericDatabaseWriter, UserIdentity } from 'convex/server';
import { action, mutation, query, type ActionCtx, type MutationCtx, type QueryCtx } from '../_generated/server';
import type { DataModel, Doc } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import type { ActorChannel } from '../schema';
import { MCP_CLIENT_CLAIM, MCP_TOKEN_ISSUER } from './mcpToken';
import { allows, isScope, SCOPE_FOR_REACH, type Reach, type Scope } from './scopes';

// De aquí salen todas las funciones públicas de Kino. Cada una nace con la
// identidad de Clerk ya resuelta, el documento `users` cargado y el alcance del
// cliente comprobado antes de leer nada. Las funciones internas (crons,
// importador) no pasan por aquí: no las llama nadie con identidad.

/** Errores tipados que el cliente puede distinguir. */
export type FnErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN_SCOPE' | 'NO_USER' | 'BUDGET_EXCEEDED' | 'REVOKED';

function fail(code: FnErrorCode, extra: Record<string, unknown> = {}): never {
  throw new ConvexError({ code, ...extra });
}

/**
 * Por qué puerta entró la escritura. Es el `createdVia` y el `completedVia`
 * que cada documento guarda: sólo el emisor del token lo sabe, así que se
 * resuelve aquí y viaja en el contexto. `sync` y `system` no llegan por esta
 * vía porque nadie los llama con identidad; los escriben a mano el importador
 * de GitHub y las funciones internas.
 */
export type Channel = Extract<ActorChannel, 'session' | 'oauth'>;

/** Quién llama: el navegador con la sesión de Clerk, o un cliente OAuth del MCP. */
function channelOf(identity: UserIdentity): Channel {
  return identity.issuer === MCP_TOKEN_ISSUER ? 'oauth' : 'session';
}

/** El cliente OAuth que firmó la petición, o nada si entró por el navegador. */
function clienteDe(identity: UserIdentity): string | undefined {
  const claim = identity[MCP_CLIENT_CLAIM];
  return typeof claim === 'string' && claim.length > 0 ? claim : undefined;
}

/**
 * Corta al cliente OAuth que la persona desconectó en Ajustes > Agentes. Es la
 * comprobación de la frontera de datos: la ruta `/api/mcp` ya contesta 403 a un
 * revocado antes de montar el servidor, y esto cubre la petición que ya iba en
 * vuelo con un token acuñado antes, que vive hasta diez minutos. Cuesta una
 * lectura por índice en cada llamada que llega por el conector, y ninguna en el
 * navegador.
 */
async function cortarSiRevocado(db: GenericDatabaseReader<DataModel>, user: Doc<'users'>, identity: UserIdentity) {
  if (channelOf(identity) !== 'oauth') return;
  const clientId = clienteDe(identity);
  if (clientId === undefined) return;
  const fila = await db
    .query('mcpClients')
    .withIndex('by_user_client', (q) => q.eq('userId', user._id).eq('clientId', clientId))
    .unique();
  if (fila?.revokedAt !== undefined) fail('REVOKED');
}

/** Lo que el envoltorio deja en el contexto de cada función. */
export type Caller = {
  user: Doc<'users'>;
  clerkId: string;
  /** Alcance efectivo de quien llama; `write` para el dueño. */
  scope: Scope;
  /** Puerta por la que entró, para la autoría de lo que escriba. */
  channel: Channel;
  /**
   * El cliente OAuth que actúa, cuando entró por el conector. Lo firma la ruta
   * desde lo que Clerk verificó y **no es una entrada de ninguna función**: es
   * lo que hace que «descartar todas las propuestas de este origen» signifique
   * algo, y un origen que el propio agente pudiera declarar no lo sostendría.
   * Vacío en el navegador, donde el origen es la persona.
   */
  clientId?: string;
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
  if (!allows(scope, required)) fail('FORBIDDEN_SCOPE', { required, granted: scope, salida: salidaPara(scope, required) });
  return { identity, scope };
}

/**
 * Qué **sí** se puede hacer en su lugar. Un 403 seco deja al agente sin más
 * salida que reintentar o rendirse, y la mitad de las veces la operación que
 * quería tiene una versión que su alcance sí alcanza: proponer en vez de
 * escribir. El principio 2 no es sólo una prohibición, es una redirección.
 */
function salidaPara(granted: Scope, required: Scope): string {
  if (granted === 'propose' && required === 'write') {
    return 'Tu alcance llega a proponer, no a escribir directo. Usa `propose_change` con la fila que te sirve de evidencia: la propuesta aparece en Hoy y la persona decide.';
  }
  if (granted === 'read') {
    return 'Tu alcance es de sólo lectura. Quien te autorizó tiene que concederte `documents:propose` o `documents:write` para que escribas algo.';
  }
  return 'Esta operación no se abre a ningún conector: se hace desde la app, con la sesión de la persona.';
}

function findUser(db: GenericDatabaseReader<DataModel>, clerkId: string) {
  return db
    .query('users')
    .withIndex('by_clerkId', (q) => q.eq('clerkId', clerkId))
    .unique();
}

/**
 * Lo mínimo con lo que se puede crear la fila de alguien. Son las dos puertas
 * por las que nace un usuario: el JWT de Clerk, que es un `UserIdentity`
 * entero, y el cuerpo de su webhook `user.created`, que llega sin JWT y del
 * que sólo salen estos cuatro campos.
 */
export type NuevaIdentidad = Pick<UserIdentity, 'subject' | 'email' | 'name' | 'pictureUrl'>;

/**
 * El documento `users` de una identidad, creándolo si es la primera vez. Un
 * usuario importado de Postgres existe por correo pero sin `clerkId`: la
 * primera sesión lo enlaza en vez de duplicarlo.
 */
export async function ensureUser(db: GenericDatabaseWriter<DataModel>, identity: NuevaIdentidad): Promise<Doc<'users'>> {
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
  await cortarSiRevocado(ctx.db, user, identity);
  return { user, clerkId: identity.subject, scope, channel: channelOf(identity), clientId: clienteDe(identity) };
}

async function callerForMutation(ctx: MutationCtx, required: Scope): Promise<Caller> {
  const { identity, scope } = await authorize(ctx.auth, required);
  const user = await ensureUser(ctx.db, identity);
  await cortarSiRevocado(ctx.db, user, identity);
  return { user, clerkId: identity.subject, scope, channel: channelOf(identity), clientId: clienteDe(identity) };
}

/**
 * La marca del alcance en la función ya registrada. No es enumerable, así que
 * no viaja a ningún sitio ni cambia lo que Convex publica; existe para que
 * `reach.test.ts` pueda recorrer los módulos y decir, función por función,
 * hasta dónde llega un agente en ella. El tipo generado de `api.*` no la
 * conserva, así que la comprobación es de test y no de compilador, y por eso
 * el test es obligatorio.
 */
export const REACH_KEY = Symbol.for('kino.reach');

/**
 * El alcance de una función registrada, o `undefined` si no pasó por aquí. Lo
 * que Convex registra es una función, no un objeto, y la marca vive en ella.
 */
export function reachOf(fn: unknown): Reach | undefined {
  if (fn === null || (typeof fn !== 'object' && typeof fn !== 'function')) return undefined;
  return (fn as Record<symbol, Reach | undefined>)[REACH_KEY];
}

/**
 * Envuelve un constructor de Convex para que marque lo que registra. El único
 * `as` de este fichero: por dentro la función es variádica, y por fuera tiene
 * exactamente la firma del constructor que envuelve, con sus genéricos.
 */
function marcando<B>(reach: Reach, builder: B): B {
  const marcador = (...args: unknown[]) => {
    const fn = (builder as (...a: unknown[]) => object)(...args);
    Object.defineProperty(fn, REACH_KEY, { value: reach, enumerable: false });
    return fn;
  };
  return marcador as B;
}

/** Sesión de navegador. Un token del conector no la tiene, ni con `write`. */
async function callerForClosed(ctx: MutationCtx): Promise<Caller> {
  const caller = await callerForMutation(ctx, SCOPE_FOR_REACH.closed);
  if (caller.channel !== 'session') fail('FORBIDDEN_SCOPE', { required: 'session', granted: caller.channel });
  return caller;
}

/** `readOnly`: lectura. Exige `read`, que es lo que tiene cualquier conector. */
export const kinoQuery = marcando(
  'readOnly',
  customQuery(
    query,
    customCtx(async (ctx) => callerForQuery(ctx, SCOPE_FOR_REACH.readOnly)),
  ),
);

/** `direct`: escritura reversible. Exige `write`; crea el documento `users` si falta. */
export const kinoMutation = marcando(
  'direct',
  customMutation(
    mutation,
    customCtx(async (ctx) => callerForMutation(ctx, SCOPE_FOR_REACH.direct)),
  ),
);

/** `proposed`: escritura que sólo propone. Un agente con `propose` llega, uno con `read` no. */
export const kinoProposal = marcando(
  'proposed',
  customMutation(
    mutation,
    customCtx(async (ctx) => callerForMutation(ctx, SCOPE_FOR_REACH.proposed)),
  ),
);

/**
 * `closed`: lo que no se toca desde fuera. Exige `write` **y** sesión de
 * navegador, así que ningún alcance del conector la alcanza. Es para lo que no
 * se puede deshacer o lo que suplanta la voz de quien manda.
 */
export const kinoClosed = marcando('closed', customMutation(mutation, customCtx(callerForClosed)));

// Las mismas puertas con argumentos en Zod, para los slices cuyo contrato ya es
// un schema de Zod con refinamientos que `v` no sabe expresar. La identidad, el
// alcance y la marca se resuelven igual: cambia sólo cómo se validan los
// argumentos.

export const kinoZodQuery = marcando(
  'readOnly',
  zCustomQuery(
    query,
    customCtx(async (ctx) => callerForQuery(ctx, SCOPE_FOR_REACH.readOnly)),
  ),
);

export const kinoZodMutation = marcando(
  'direct',
  zCustomMutation(
    mutation,
    customCtx(async (ctx) => callerForMutation(ctx, SCOPE_FOR_REACH.direct)),
  ),
);

export const kinoZodProposal = marcando(
  'proposed',
  zCustomMutation(
    mutation,
    customCtx(async (ctx) => callerForMutation(ctx, SCOPE_FOR_REACH.proposed)),
  ),
);

export const kinoZodClosed = marcando('closed', zCustomMutation(mutation, customCtx(callerForClosed)));

/**
 * Lo que sólo llama el propio servidor de Kino, sin persona detrás. Exige un
 * token del emisor del conector (`lib/mcpToken.ts`) cuyo `sub` es el nombre
 * del servicio; ese token sólo lo firma quien tiene la clave privada, que vive
 * en Vercel. Una sesión de Clerk o un conector OAuth llevan siempre un id de
 * Clerk en el `sub`, así que ninguno llega: por eso se marca `closed`. No
 * carga ningún `users`, porque no actúa en nombre de nadie.
 */
export const kinoServicio = (servicio: string) =>
  marcando(
    'closed',
    customMutation(
      mutation,
      customCtx(async (ctx: MutationCtx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) fail('UNAUTHENTICATED');
        if (identity.issuer !== MCP_TOKEN_ISSUER || identity.subject !== servicio) {
          fail('FORBIDDEN_SCOPE', { required: 'service', granted: channelOf(identity) });
        }
        return {};
      }),
    ),
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
 * El presupuesto por defecto de cualquier cosa que llame fuera. Es la
 * restricción 4 de `AGENTS.md` escrita donde se aplica: una acción nueva nace
 * acotada sin que su autor tenga que acordarse.
 *
 * Pasar otro número es una decisión, no un ajuste, y se escribe en el
 * comentario de esa acción. Hoy sólo hay una por encima: borrar la cuenta.
 */
export const DEFAULT_BUDGET_MS = 10_000;

/**
 * Acción, que es lo único que llama fuera. Nace con el presupuesto por defecto
 * y con alcance `direct`; los dos se declaran en la definición cuando hacen
 * falta otros: `kinoAction(5_000, 'closed')({ ... })`.
 */
export const kinoAction = (budgetMs: number = DEFAULT_BUDGET_MS, reach: Reach = 'direct') =>
  marcando(
    reach,
    customAction(
    action,
    customCtx(async (ctx: ActionCtx) => {
      const { identity, scope } = await authorize(ctx.auth, SCOPE_FOR_REACH[reach]);
      const channel = channelOf(identity);
      if (reach === 'closed' && channel !== 'session') {
        fail('FORBIDDEN_SCOPE', { required: 'session', granted: channel });
      }
      // Anotado a mano: el tipo de `internal` depende de todos los módulos,
      // este incluido, y sin la anotación el compilador entra en bucle.
      const user: Doc<'users'> | null = await ctx.runQuery(internal.users.byClerkId, {
        clerkId: identity.subject,
      });
      if (!user) fail('NO_USER');
      const clientId = clienteDe(identity);
      if (channel === 'oauth' && clientId !== undefined) {
        const revocado: boolean = await ctx.runQuery(internal.mcpClients.revocado, { userId: user._id, clientId });
        if (revocado) fail('REVOKED');
      }
      const caller: Caller & { budget: Budget } = {
        user,
        clerkId: identity.subject,
        scope,
        channel,
        clientId,
        budget: budgetFrom(budgetMs),
      };
      return caller;
      }),
    ),
  );
