// Importa Postgres en un deployment de Convex, tabla a tabla en el orden de
// las referencias. Idempotente: cada fila se reemplaza por su id de Postgres,
// así que correrlo dos veces deja el mismo estado.
//
// Uso:
//   CONVEX_DEPLOY_KEY=... pnpm migrate:convex --source <url directa> --url <url del deployment>
// Nunca contra producción de Postgres: el origen es una copia restaurada del
// respaldo (ver restore-pglite.mts) o la rama de preview.
import { parseArgs } from 'node:util';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { TableNames } from '../../convex/_generated/dataModel';
import type { ImportableTable } from '../../convex/migrate';
import * as pg from '../../src/shared/db/schema';
import { convexAdmin, type ConvexAdmin } from './convex-admin';
import * as t from './transform';
import { Refs, SELF_REFERENCING, type Insert } from './transform';

const { values: flags } = parseArgs({
  options: { source: { type: 'string' }, url: { type: 'string' } },
});
const source = flags.source ?? process.env.SOURCE_DATABASE_URL;
const url = flags.url ?? process.env.NEXT_PUBLIC_CONVEX_URL;
const deployKey = process.env.CONVEX_DEPLOY_KEY;
if (!source || !url || !deployKey) {
  throw new Error('Faltan --source, --url o CONVEX_DEPLOY_KEY');
}
if (/-pooler\./.test(source)) throw new Error('El origen tiene que ser la cadena directa, sin -pooler');

const BATCH = 50;

type Step = (db: ReturnType<typeof drizzle>, admin: ConvexAdmin, refs: Refs) => Promise<string>;

/** Una tabla: leerla entera, transformarla y subirla por lotes. */
function step<T extends ImportableTable, S extends PgTable>(
  table: T,
  from: S,
  transform: (row: S['$inferSelect'], refs: Refs) => Insert<T>,
): Step {
  return async (db, admin, refs) => {
    const rows = (await db.select().from(from as PgTable)) as S['$inferSelect'][];
    const passes = SELF_REFERENCING.includes(table) ? 2 : 1;
    let inserted = 0;
    let replaced = 0;
    for (let pass = 0; pass < passes; pass += 1) {
      const docs = rows.map((row) => transform(row, refs));
      for (let i = 0; i < docs.length; i += BATCH) {
        const result = await admin.mutation<{ inserted: number; replaced: number }>(
          'migrate:upsert',
          { table, rows: docs.slice(i, i + BATCH) },
        );
        inserted += result.inserted;
        replaced += result.replaced;
      }
      refs.set(table, await admin.query<{ pgId: string; id: string }[]>('migrate:pgIds', { table }));
    }
    return `${table.padEnd(24)} ${String(rows.length).padStart(5)} filas  ${inserted} nuevas, ${replaced} reemplazadas`;
  };
}

/** El orden es el de las referencias: nadie apunta a una tabla que va detrás. */
const PLAN: Step[] = [
  step('users', pg.users, t.user),
  step('userSettings', pg.userSettings, t.userSettings),
  step('userEnergyProfile', pg.userEnergyProfile, t.userEnergyProfile),
  step('systems', pg.systems, t.system),
  step('contextTags', pg.contextTags, t.contextTag),
  step('systemStatusDefinitions', pg.systemStatusDefinitions, t.systemStatusDefinition),
  step('sprints', pg.sprints, t.sprint),
  step('folders', pg.folders, t.folder),
  step('tasks', pg.tasks, t.task),
  step('pages', pg.pages, t.page),
  step('stickyNotes', pg.stickyNotes, t.stickyNote),
  step('pageSnapshots', pg.pageSnapshots, t.pageSnapshot),
  step('entities', pg.entities, t.entity),
  step('entityRelations', pg.entityRelations, t.entityRelation),
  step('taskPageLinks', pg.taskPageLinks, t.taskPageLink),
  step('pageTags', pg.pageTags, t.pageTag),
  step('pageEntityMentions', pg.pageEntityMentions, t.pageEntityMention),
  step('taskReminders', pg.taskReminders, t.taskReminder),
  step('timeLogs', pg.timeLogs, t.timeLog),
  step('syncConnections', pg.syncConnections, t.syncConnection),
  step('pushSubscriptions', pg.pushSubscriptions, t.pushSubscription),
  step('energyCheckins', pg.energyCheckins, t.energyCheckin),
  step('energyPredictions', pg.energyPredictions, t.energyPrediction),
  step('behaviorSnapshots', pg.behaviorSnapshots, t.behaviorSnapshot),
  step('cronRuns', pg.cronRuns, t.cronRun),
  step('rateLimits', pg.rateLimits, t.rateLimit),
];

const client = postgres(source, { max: 1 });
const db = drizzle(client);
const admin = convexAdmin(url, deployKey);
const refs = new Refs();
const start = Date.now();
try {
  for (const run of PLAN) console.log(await run(db, admin, refs));
} finally {
  await client.end();
}
console.log(`Importado en ${((Date.now() - start) / 1000).toFixed(1)} s hacia ${url}`);

// El tipo se usa para que un paso no pueda declarar una tabla que el schema no tenga.
export type { TableNames };
