import type { AnyDataModel, GenericDatabaseWriter } from 'convex/server';
import { v, type GenericId } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';
import type { TableNames } from './_generated/dataModel';

// Lo que el importador de Postgres llama con la clave de deploy. Son funciones
// internas: no tienen identidad de usuario y solo el CLI o un cliente con la
// clave de administración pueden invocarlas.

/** Índice y campos que identifican una fila importada, por tabla. */
const UPSERT_KEYS = {
  users: { index: 'by_pgId', fields: ['pgId'] },
  systems: { index: 'by_pgId', fields: ['pgId'] },
  tasks: { index: 'by_pgId', fields: ['pgId'] },
  sprints: { index: 'by_pgId', fields: ['pgId'] },
  contextTags: { index: 'by_pgId', fields: ['pgId'] },
  systemStatusDefinitions: { index: 'by_pgId', fields: ['pgId'] },
  taskReminders: { index: 'by_pgId', fields: ['pgId'] },
  folders: { index: 'by_pgId', fields: ['pgId'] },
  pages: { index: 'by_pgId', fields: ['pgId'] },
  stickyNotes: { index: 'by_pgId', fields: ['pgId'] },
  pageSnapshots: { index: 'by_pgId', fields: ['pgId'] },
  entities: { index: 'by_pgId', fields: ['pgId'] },
  entityRelations: { index: 'by_pgId', fields: ['pgId'] },
  energyCheckins: { index: 'by_pgId', fields: ['pgId'] },
  energyPredictions: { index: 'by_pgId', fields: ['pgId'] },
  behaviorSnapshots: { index: 'by_pgId', fields: ['pgId'] },
  timeLogs: { index: 'by_pgId', fields: ['pgId'] },
  syncConnections: { index: 'by_pgId', fields: ['pgId'] },
  pushSubscriptions: { index: 'by_pgId', fields: ['pgId'] },
  cronRuns: { index: 'by_pgId', fields: ['pgId'] },
  userSettings: { index: 'by_user', fields: ['userId'] },
  userEnergyProfile: { index: 'by_user', fields: ['userId'] },
  taskPageLinks: { index: 'by_task_page', fields: ['taskId', 'pageId'] },
  pageTags: { index: 'by_page_tag', fields: ['pageId', 'tagId'] },
  pageEntityMentions: { index: 'by_page_entity', fields: ['pageId', 'entityId'] },
  rateLimits: { index: 'by_identity_bucket', fields: ['identity', 'bucket'] },
} as const satisfies Partial<Record<TableNames, { index: string; fields: readonly string[] }>>;

export type ImportableTable = keyof typeof UPSERT_KEYS;

/** La parte de `db.query` que usa el upsert, con índice y campos como texto. */
type DynamicQuery = {
  withIndex(
    index: string,
    range: (q: IndexRange) => IndexRange,
  ): { unique(): Promise<{ _id: GenericId<string> } | null> };
};
type IndexRange = { eq(field: string, value: unknown): IndexRange };
export const IMPORTABLE_TABLES = Object.keys(UPSERT_KEYS) as ImportableTable[];

const importableTable = v.union(
  ...(IMPORTABLE_TABLES.map((table) => v.literal(table)) as [
    ReturnType<typeof v.literal<ImportableTable>>,
  ]),
);

/**
 * Inserta o reemplaza cada fila por su clave de importación. Correrlo dos
 * veces con las mismas filas deja el mismo estado. Los documentos llegan ya
 * transformados y con ids de Convex; el schema los valida al escribir.
 */
export const upsert = internalMutation({
  args: { table: importableTable, rows: v.array(v.any()) },
  returns: v.object({ inserted: v.number(), replaced: v.number() }),
  handler: async (ctx, { table, rows }) => {
    const key = UPSERT_KEYS[table];
    // La tabla llega como dato, así que el tipo no puede fijar sus índices por
    // adelantado. La validación real la hace el schema en insert y replace.
    const db = ctx.db as unknown as GenericDatabaseWriter<AnyDataModel>;
    let inserted = 0;
    let replaced = 0;
    for (const row of rows as Record<string, unknown>[]) {
      const existing = await (db.query(table) as unknown as DynamicQuery)
        .withIndex(key.index, (q) => key.fields.reduce((range, field) => range.eq(field, row[field]), q))
        .unique();
      if (existing) {
        await db.replace(existing._id, row);
        replaced += 1;
      } else {
        await db.insert(table, row);
        inserted += 1;
      }
    }
    return { inserted, replaced };
  },
});

/** Correspondencia id de Postgres → id de Convex de una tabla ya importada. */
export const pgIds = internalQuery({
  args: { table: importableTable },
  returns: v.array(v.object({ pgId: v.string(), id: v.string() })),
  handler: async (ctx, { table }) => {
    const db = ctx.db as unknown as GenericDatabaseWriter<AnyDataModel>;
    const docs = await db.query(table).collect();
    return docs.flatMap((doc) =>
      typeof doc.pgId === 'string' ? [{ pgId: doc.pgId, id: doc._id as string }] : [],
    );
  },
});

/**
 * La misma huella que `scripts/backup/verify.sh`, sobre Convex: filas por
 * tabla y lo que un import incompleto pierde primero.
 */
export const huella = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const lines: string[] = [];
    for (const table of [...IMPORTABLE_TABLES].sort()) {
      const db = ctx.db as unknown as GenericDatabaseWriter<AnyDataModel>;
      const docs = await db.query(table).collect();
      lines.push(`tabla ${table} ${docs.length}`);
    }
    const pages = await ctx.db.query('pages').collect();
    const withContent = pages.filter((page) => (page.content?.length ?? 0) > 0);
    lines.push(`pages_con_contenido ${withContent.length}`);
    // Puntos de código, como `length()` de Postgres, no unidades UTF-16.
    lines.push(
      `pages_bytes_contenido ${pages.reduce((sum, page) => sum + [...(page.content ?? '')].length, 0)}`,
    );
    const relations = await ctx.db.query('entityRelations').collect();
    lines.push(`entidades_con_relaciones ${new Set(relations.map((r) => r.fromEntityId)).size}`);
    const tasks = await ctx.db.query('tasks').collect();
    lines.push(`tareas_con_sistema ${tasks.filter((task) => task.systemId).length}`);
    // Las referencias a la propia tabla son lo que una importación en una sola
    // pasada pierde sin que ninguna cuenta por tabla lo delate.
    lines.push(`tareas_con_padre ${tasks.filter((task) => task.parentTaskId).length}`);
    const folders = await ctx.db.query('folders').collect();
    lines.push(`carpetas_con_padre ${folders.filter((folder) => folder.parentId).length}`);
    lines.push(`paginas_con_padre ${pages.filter((page) => page.parentPageId).length}`);
    return lines;
  },
});
