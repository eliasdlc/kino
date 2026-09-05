// La huella de `scripts/backup/verify.sh`, calculada sobre Postgres y sobre
// Convex con las mismas líneas, para que `diff` diga si el import trajo todo.
// Solo lee. Las tablas que no viajan (identidad, OAuth, claves) no cuentan en
// ningún lado; la línea de migraciones tampoco, porque Convex no tiene libro.
//
// Uso:
//   CONVEX_DEPLOY_KEY=... pnpm tsx scripts/migrate-to-convex/verify.mts \
//     --source <url> --url <url del deployment> --out /tmp/huellas
// Deja huella-pg.txt y huella-convex.txt en --out y termina con 1 si difieren.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { getTableName, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { IMPORTABLE_TABLES } from '../../convex/migrate';
import { convexAdmin } from './convex-admin';
import { PG_TABLES } from './tables';

const { values: flags } = parseArgs({
  options: { source: { type: 'string' }, url: { type: 'string' }, out: { type: 'string' } },
});
const source = flags.source ?? process.env.SOURCE_DATABASE_URL;
const url = flags.url ?? process.env.NEXT_PUBLIC_CONVEX_URL;
const deployKey = process.env.CONVEX_DEPLOY_KEY;
const out = flags.out ?? '.';
if (!source || !url || !deployKey) throw new Error('Faltan --source, --url o CONVEX_DEPLOY_KEY');


const client = postgres(source, { max: 1 });
const db = drizzle(client);
const count = async (query: ReturnType<typeof sql>) =>
  Number(((await db.execute(query)) as unknown as { n: string | number }[])[0].n);

const huellaPg: string[] = [];
try {
  for (const table of [...IMPORTABLE_TABLES].sort()) {
    const name = getTableName(PG_TABLES[table]);
    huellaPg.push(`tabla ${table} ${await count(sql`select count(*) as n from ${sql.identifier(name)}`)}`);
  }
  huellaPg.push(
    `pages_con_contenido ${await count(sql`select count(*) as n from pages where content is not null and length(content) > 0`)}`,
  );
  huellaPg.push(
    `pages_bytes_contenido ${await count(sql`select coalesce(sum(length(content)), 0) as n from pages`)}`,
  );
  huellaPg.push(
    `entidades_con_relaciones ${await count(sql`select count(distinct from_entity_id) as n from entity_relations`)}`,
  );
  huellaPg.push(
    `tareas_con_sistema ${await count(sql`select count(*) as n from tasks where system_id is not null`)}`,
  );
  huellaPg.push(
    `tareas_con_padre ${await count(sql`select count(*) as n from tasks where parent_task_id is not null`)}`,
  );
  huellaPg.push(
    `carpetas_con_padre ${await count(sql`select count(*) as n from folders where parent_id is not null`)}`,
  );
  huellaPg.push(
    `paginas_con_padre ${await count(sql`select count(*) as n from pages where parent_page_id is not null`)}`,
  );
} finally {
  await client.end();
}

const huellaConvex = await convexAdmin(url, deployKey).query<string[]>('migrate:huella');

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'huella-pg.txt'), huellaPg.join('\n') + '\n');
writeFileSync(join(out, 'huella-convex.txt'), huellaConvex.join('\n') + '\n');

const differences = huellaPg
  .map((line, i) => (line === huellaConvex[i] ? null : `- ${line}\n+ ${huellaConvex[i] ?? '(falta)'}`))
  .filter((line): line is string => line !== null);
if (differences.length === 0) {
  console.log(`Huellas iguales: ${huellaPg.length} líneas en ${out}`);
} else {
  console.log(differences.join('\n'));
  process.exit(1);
}
