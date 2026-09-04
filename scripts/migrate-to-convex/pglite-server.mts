// Un Postgres local sin instalar nada: PGlite con el protocolo de cable en un
// puerto fijo, con datos persistentes en disco. Sirve de destino para
// `scripts/backup/restore.sh` y de origen para el importador cuando no hay
// docker a mano. Es el mismo motor que la batería de integración.
//
// Uso: PGLITE_DIR=/tmp/kino-restore/pgdata PGLITE_PORT=5434 \
//      pnpm tsx scripts/migrate-to-convex/pglite-server.mts
// Cadena resultante: postgresql://postgres:postgres@127.0.0.1:5434/postgres
import { PGlite } from '@electric-sql/pglite';
import { ltree } from '@electric-sql/pglite/contrib/ltree';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const dataDir = process.env.PGLITE_DIR ?? '/tmp/kino-restore/pgdata';
const port = Number(process.env.PGLITE_PORT ?? 5434);

const pglite = await PGlite.create({ dataDir, extensions: { ltree, unaccent, uuid_ossp } });
await pglite.exec(
  `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS "ltree"; CREATE EXTENSION IF NOT EXISTS "unaccent";`,
);
// Varias conexiones a la vez (la app y un psql de comprobación): PGlite es
// de una sola conexión y el servidor las multiplexa.
const server = new PGLiteSocketServer({ db: pglite, host: '127.0.0.1', port, maxConnections: 4 });
await server.start();
console.log(`postgresql://postgres:postgres@${server.getServerConn()}/postgres`);

const stop = async () => {
  await server.stop();
  await pglite.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
