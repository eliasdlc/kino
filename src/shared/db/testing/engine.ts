import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { ltree } from "@electric-sql/pglite/contrib/ltree";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Levanta la base contra la que corre la batería de integración y devuelve cómo
 * apagarla. La llama el setup de vitest, una vez por archivo de test.
 *
 * Por defecto es PGlite: Postgres compilado a WASM, en memoria, con las mismas
 * extensiones que Neon (`ltree` 1.3, `uuid-ossp` 1.1, `unaccent` 1.1). Una base
 * por archivo, así que el aislamiento entre archivos deja de depender de que
 * nadie olvide un TRUNCATE y pasa a ser la estructura: dos archivos que escriben
 * la misma tabla pueden correr a la vez.
 *
 * Por qué por socket y no con el driver nativo de PGlite: `drizzle-orm/pglite`
 * devuelve `{ rows }` en `db.execute` y `postgres-js` devuelve el array directo.
 * Cuatro consultas crudas leen ese resultado (`folders.service.ts:87` y las tres
 * de `notifications.queries.ts`), así que con el driver nativo el test ejercería
 * una forma que producción no tiene. Hablando el protocolo de cable el driver es
 * el mismo de producción y esa diferencia no existe.
 *
 * Con `TEST_DATABASE_URL` corre contra ese Postgres en vez de PGlite, con los
 * mismos tests: es la forma de comprobar contra el motor exacto de producción,
 * que es 17 mientras PGlite es 18. La variable es propia y no `DATABASE_URL` a
 * propósito — la batería deja la base en TRUNCATE, y una `DATABASE_URL` de
 * producción exportada en la shell nunca debe poder llegar hasta aquí. Por eso
 * esta función siempre sobreescribe `DATABASE_URL`: la base se nombra a mano o
 * no se usa.
 */
export async function startTestDatabase(): Promise<() => Promise<void>> {
  const external = process.env.TEST_DATABASE_URL;
  if (external) {
    process.env.DATABASE_URL = external;
    // Las migraciones de una base compartida las aplica quien la administra
    // (`pnpm db:migrate`), no cada archivo de test.
    return async () => {};
  }

  const pglite = await PGlite.create({ extensions: { ltree, unaccent, uuid_ossp } });
  // Lo mismo que `init-db/01-extensions.sql` deja hecho en el contenedor: la
  // primera migración declara una columna `ltree` y falla sin esto.
  await pglite.exec(
    `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS "ltree";`,
  );

  // Puerto 0: lo asigna el sistema y el servidor lo reporta, así que N archivos
  // en paralelo no pueden pelearse por uno.
  const server = new PGLiteSocketServer({ db: pglite, host: "127.0.0.1", port: 0 });
  await server.start();
  const [host, port] = server.getServerConn().split(":");
  const url = `postgresql://postgres:postgres@${host}:${port}/postgres`;

  // Cliente aparte y efímero para migrar: el de la app se crea al importar
  // `@/shared/db`, que todavía no ha ocurrido porque DATABASE_URL no está puesta.
  const migrationClient = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(migrationClient), {
      migrationsFolder: fileURLToPath(new URL("../../../../drizzle", import.meta.url)),
    });
  } finally {
    await migrationClient.end();
  }

  process.env.DATABASE_URL = url;

  return async () => {
    await server.stop();
    await pglite.close();
  };
}
