#!/usr/bin/env bash
# Volcado cifrado de la base de DATABASE_URL.
#
# Produce <OUT_DIR>/kino-<fecha>.dump.age: un pg_dump en formato custom (-Fc,
# comprimido, restaurable por partes con pg_restore) cifrado para el
# destinatario age de BACKUP_AGE_RECIPIENT. Antes de cifrar comprueba que el
# volcado tiene contenido: un archivo vacío subido a diario es peor que un
# fallo en rojo.
#
# Uso: DATABASE_URL=... BACKUP_AGE_RECIPIENT=age1... scripts/backup/dump.sh [OUT_DIR]
# Lo llama el workflow backup.yml; en local sirve para ensayar el mismo camino.
set -euo pipefail

: "${DATABASE_URL:?Falta DATABASE_URL (cadena directa, sin -pooler)}"
: "${BACKUP_AGE_RECIPIENT:?Falta BACKUP_AGE_RECIPIENT (clave pública age1...)}"

out_dir="${1:-.}"
stamp="$(date -u +%Y-%m-%dT%H%M%SZ)"
plain="$out_dir/kino-$stamp.dump"
encrypted="$plain.age"

# pg_dump abre varias sesiones y usa snapshot exportado: el endpoint pooled de
# Neon (PgBouncer) no lo soporta. Con la URL pooled falla, no corrompe.
pg_dump --format=custom --no-owner --no-privileges --file="$plain" "$DATABASE_URL"

entries="$(pg_restore --list "$plain" | grep -c '^[0-9]' || true)"
if [ "$entries" -lt 10 ]; then
  echo "El volcado sólo tiene $entries entradas: algo falló." >&2
  exit 1
fi

age --recipient "$BACKUP_AGE_RECIPIENT" --output "$encrypted" "$plain"
rm -f "$plain"

echo "$encrypted ($entries entradas, $(du -h "$encrypted" | cut -f1))"
