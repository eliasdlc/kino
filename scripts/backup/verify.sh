#!/usr/bin/env bash
# Huella de contenido de una base: filas por tabla y los datos que un volcado
# incompleto perdería primero (cuadernos con texto, entidades con relaciones).
#
# Corre igual sobre la base origen y la restaurada; si `diff` no dice nada,
# la restauración trajo todo. Sólo lee.
#
# Uso: scripts/backup/verify.sh <DATABASE_URL>
set -euo pipefail
url="${1:?Falta la URL de la base}"

psql "$url" --no-psqlrc --tuples-only --no-align --field-separator=' ' <<'SQL'
select 'tabla ' || tablename || ' ' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I', tablename), false, true, '')))[1]::text
from pg_tables where schemaname = 'public' order by tablename;
select 'pages_con_contenido ' || count(*) from pages where content is not null and length(content) > 0;
select 'pages_bytes_contenido ' || coalesce(sum(length(content)), 0) from pages;
select 'entidades_con_relaciones ' || count(distinct from_entity_id) from entity_relations;
select 'tareas_con_sistema ' || count(*) from tasks where system_id is not null;
-- El libro de migraciones vive en el esquema `drizzle`, fuera de `public`, así que
-- las cuentas de arriba no lo ven. Sin él, el siguiente deploy reintenta migraciones
-- ya aplicadas: es justo lo que una huella de restauración tiene que delatar.
-- Se pregunta por `to_regclass` primero porque una base sin el esquema `drizzle` es
-- justo el caso que hay que delatar, y un `select` directo sobre una tabla ausente
-- aborta el script en vez de escribir la línea que lo dice.
select 'migraciones_aplicadas ' || case
  when to_regclass('drizzle.__drizzle_migrations') is null then 'ausente'
  else (xpath('/row/c/text()', query_to_xml('select count(*) as c from drizzle.__drizzle_migrations', false, true, '')))[1]::text
end;
SQL
