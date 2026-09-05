// Restaura un volcado de producción en un PGlite de disco, sin docker y sin
// servidor: la salida en texto de `pg_restore -f` se aplica sentencia a
// sentencia, y cada bloque `COPY ... FROM stdin` entra por el COPY nativo de
// PGlite desde un Blob, que es lo único que el socket de cable no sabe hacer.
//
// Uso:
//   age --decrypt --identity ~/.config/kino/backup-age.key -o kino.dump kino-<fecha>.dump.age
//   pg_restore --clean --if-exists --no-owner --no-privileges -f plain.sql kino.dump
//   PGLITE_DIR=/tmp/kino-restore/pgdata pnpm tsx scripts/migrate-to-convex/restore-pglite.mts plain.sql
// Después, `pglite-server.mts` sirve ese directorio por el puerto 5434.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { ltree } from '@electric-sql/pglite/contrib/ltree';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';

const file = process.argv[2];
if (!file) throw new Error('Falta el fichero plain.sql producido por pg_restore -f');
const dataDir = process.env.PGLITE_DIR ?? '/tmp/kino-restore/pgdata';

const pglite = await PGlite.create({ dataDir, extensions: { ltree, unaccent, uuid_ossp } });
const lines = readFileSync(file, 'utf8').split('\n');

let statement = '';
let copy: { header: string; rows: string[] } | null = null;
let statements = 0;
let copied = 0;
const start = Date.now();

for (const line of lines) {
  if (copy) {
    if (line === '\\.') {
      // Una tabla vacía es un bloque sin filas; un Blob con una línea vacía
      // sería una fila con todas las columnas en blanco.
      if (copy.rows.length > 0) {
        const blob = new Blob([copy.rows.join('\n') + '\n']);
        await pglite.query(copy.header.replace(/FROM stdin;?$/, "FROM '/dev/blob'"), [], { blob });
        copied += copy.rows.length;
      }
      copy = null;
    } else {
      copy.rows.push(line);
    }
    continue;
  }
  if (line.startsWith('--') || line.trim() === '') continue;
  if (line.startsWith('COPY ')) {
    copy = { header: line, rows: [] };
    continue;
  }
  // Ajustes de sesión de pg_dump que PGlite no conoce y no necesita.
  if (/^(SET|SELECT pg_catalog\.set_config|\\)/.test(line)) continue;
  statement += line + '\n';
  if (line.trimEnd().endsWith(';')) {
    await pglite.exec(statement);
    statements += 1;
    statement = '';
  }
}

await pglite.close();
console.log(`${statements} sentencias, ${copied} filas copiadas, ${((Date.now() - start) / 1000).toFixed(1)} s`);
