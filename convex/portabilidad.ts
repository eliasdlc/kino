import type { Doc, Id, TableNames } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { EXPORTED_TABLES } from '../src/features/settings/export-manifest';
import { kinoZodQuery } from './lib/fn';

// El export del workspace: una lectura por usuario, no por sistema, con una
// entrada por cada tabla que el manifiesto declara. Antes eran cuatro tablas
// leídas sistema a sistema mientras la pantalla prometía «completo»; ahora la
// misma lista gobierna lo que se lee y lo que la pantalla enseña, así que las
// dos no pueden divergir sin que falle `export.test.ts`.

/**
 * Tope de documentos por tabla. Una lectura que puede crecer sin límite nace
 * acotada, y aquí el techo tiene que ser alto porque el export es la vía por la
 * que alguien se lleva su trabajo: lo que no quepa se dice en el manifiesto del
 * ZIP en vez de faltar en silencio.
 */
export const EXPORT_TABLE_CAP = 5_000;

/** Cada tabla que viaja sabe cómo encontrar lo que es de una persona. */
type Lector = (ctx: QueryCtx, userId: Id<'users'>) => Promise<Doc<TableNames>[]>;

async function pagesOf(ctx: QueryCtx, userId: Id<'users'>) {
  return ctx.db.query('pages').withIndex('by_user_alive', (q) => q.eq('userId', userId)).take(EXPORT_TABLE_CAP);
}

async function entitiesOf(ctx: QueryCtx, userId: Id<'users'>) {
  return ctx.db.query('entities').withIndex('by_user', (q) => q.eq('userId', userId)).take(EXPORT_TABLE_CAP);
}

export const LECTORES: Record<string, Lector> = {
  users: async (ctx, userId) => {
    const doc = await ctx.db.get(userId);
    return doc ? [doc] : [];
  },
  userSettings: (ctx, userId) => ctx.db.query('userSettings').withIndex('by_user', (q) => q.eq('userId', userId)).take(EXPORT_TABLE_CAP),
  systems: (ctx, userId) => ctx.db.query('systems').withIndex('by_user_sort', (q) => q.eq('userId', userId)).take(EXPORT_TABLE_CAP),
  tasks: (ctx, userId) => ctx.db.query('tasks').withIndex('by_user_alive_status', (q) => q.eq('userId', userId)).take(EXPORT_TABLE_CAP),
  sprints: (ctx, userId) => ctx.db.query('sprints').withIndex('by_user', (q) => q.eq('userId', userId)).take(EXPORT_TABLE_CAP),
  contextTags: (ctx, userId) => ctx.db.query('contextTags').withIndex('by_user', (q) => q.eq('userId', userId)).take(EXPORT_TABLE_CAP),
  // Configuración del producto y no de la persona: viaja entera para que
  // reimportar un tablero sepa qué columnas tenía cada arquetipo.
  systemStatusDefinitions: (ctx) => ctx.db.query('systemStatusDefinitions').take(EXPORT_TABLE_CAP),
  taskReminders: (ctx, userId) => ctx.db.query('taskReminders').withIndex('by_user', (q) => q.eq('userId', userId)).take(EXPORT_TABLE_CAP),
  academicPeriods: (ctx, userId) => ctx.db.query('academicPeriods').withIndex('by_user', q => q.eq('userId', userId)).take(EXPORT_TABLE_CAP),
  folders: (ctx, userId) => ctx.db.query('folders').withIndex('by_user_alive', (q) => q.eq('userId', userId)).take(EXPORT_TABLE_CAP),
  pages: pagesOf,
  stickyNotes: (ctx, userId) => ctx.db.query('stickyNotes').withIndex('by_user_alive', (q) => q.eq('userId', userId)).take(EXPORT_TABLE_CAP),
  pageSnapshots: (ctx, userId) => ctx.db.query('pageSnapshots').withIndex('by_user', (q) => q.eq('userId', userId)).take(EXPORT_TABLE_CAP),
  entities: entitiesOf,
  entityRelations: async (ctx, userId) => {
    const rows = [];
    for (const entity of await entitiesOf(ctx, userId)) {
      rows.push(...(await ctx.db.query('entityRelations').withIndex('by_from', (q) => q.eq('fromEntityId', entity._id)).collect()));
    }
    return rows;
  },
  taskPageLinks: async (ctx, userId) => porPagina(ctx, userId, (pageId) => ctx.db.query('taskPageLinks').withIndex('by_page', (q) => q.eq('pageId', pageId)).collect()),
  pageTags: async (ctx, userId) => porPagina(ctx, userId, (pageId) => ctx.db.query('pageTags').withIndex('by_page_tag', (q) => q.eq('pageId', pageId)).collect()),
  pageEntityMentions: async (ctx, userId) =>
    porPagina(ctx, userId, (pageId) => ctx.db.query('pageEntityMentions').withIndex('by_page_entity', (q) => q.eq('pageId', pageId)).collect()),
  userEnergyProfile: (ctx, userId) => ctx.db.query('userEnergyProfile').withIndex('by_user', (q) => q.eq('userId', userId)).take(EXPORT_TABLE_CAP),
  energyCheckins: (ctx, userId) => ctx.db.query('energyCheckins').withIndex('by_user_day_slot', (q) => q.eq('userId', userId)).take(EXPORT_TABLE_CAP),
  energyPredictions: (ctx, userId) => ctx.db.query('energyPredictions').withIndex('by_user_day_slot', (q) => q.eq('userId', userId)).take(EXPORT_TABLE_CAP),
  behaviorSnapshots: (ctx, userId) => ctx.db.query('behaviorSnapshots').withIndex('by_user_day', (q) => q.eq('userId', userId)).take(EXPORT_TABLE_CAP),
  timeLogs: (ctx, userId) => ctx.db.query('timeLogs').withIndex('by_user_started', (q) => q.eq('userId', userId)).take(EXPORT_TABLE_CAP),
};

/** Filas que cuelgan de las páginas de la persona, que es como se llega a las tablas de relación. */
async function porPagina<T>(ctx: QueryCtx, userId: Id<'users'>, leer: (pageId: Id<'pages'>) => Promise<T[]>): Promise<T[]> {
  const rows: T[] = [];
  for (const page of await pagesOf(ctx, userId)) rows.push(...(await leer(page._id)));
  return rows;
}

/**
 * Todo el workspace de la persona, tabla por tabla. Lo que llegó al tope se
 * cuenta aparte: el ZIP lo escribe en su manifiesto para que un export
 * recortado se vea, en vez de parecer completo.
 */
export const workspace = kinoZodQuery({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.user._id;
    const tablas: Record<string, unknown[]> = {};
    const topadas: string[] = [];
    for (const { tabla } of EXPORTED_TABLES) {
      const lector = LECTORES[tabla];
      const filas = lector ? await lector(ctx, userId) : [];
      tablas[tabla] = filas;
      if (filas.length >= EXPORT_TABLE_CAP) topadas.push(tabla);
    }
    return { tablas, topadas, tope: EXPORT_TABLE_CAP };
  },
});
