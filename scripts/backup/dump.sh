#!/usr/bin/env bash
# Volcado cifrado del deployment de Convex que identifica CONVEX_DEPLOY_KEY.
#
# Produce <OUT_DIR>/kino-<fecha>.zip.age: el snapshot de `npx convex export`
# (un documents.jsonl por tabla más los ficheros de _storage) cifrado para el
# destinatario age de BACKUP_AGE_RECIPIENT. Antes de cifrar comprueba que el
# snapshot trae tablas: un archivo vacío subido a diario es peor que un fallo
# en rojo.
#
# Uso: CONVEX_DEPLOY_KEY=prod:... BACKUP_AGE_RECIPIENT=age1... scripts/backup/dump.sh [OUT_DIR]
# Lo llama el workflow backup.yml; en local sirve para ensayar el mismo camino
# (con la clave de dev se vuelca el deployment de dev).
set -euo pipefail

: "${CONVEX_DEPLOY_KEY:?Falta CONVEX_DEPLOY_KEY (clave de deploy del deployment a volcar)}"
: "${BACKUP_AGE_RECIPIENT:?Falta BACKUP_AGE_RECIPIENT (clave pública age1...)}"

out_dir="${1:-.}"
stamp="$(date -u +%Y-%m-%dT%H%M%SZ)"
plain="$out_dir/kino-$stamp.zip"
encrypted="$plain.age"

npx convex export --include-file-storage --path "$plain"

tables="$(unzip -Z1 "$plain" | grep -c '/documents\.jsonl$' || true)"
if [ "$tables" -lt 10 ]; then
  echo "El snapshot sólo trae $tables tablas: algo falló." >&2
  exit 1
fi

age --recipient "$BACKUP_AGE_RECIPIENT" --output "$encrypted" "$plain"
rm -f "$plain"

echo "$encrypted ($tables tablas, $(du -h "$encrypted" | cut -f1))"
