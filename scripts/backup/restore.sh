#!/usr/bin/env bash
# Restaura un volcado cifrado sobre la base de TARGET_URL y cronometra.
#
# Descifra con la clave privada age de AGE_IDENTITY_FILE y aplica el dump con
# --clean: cada objeto se borra y se vuelve a crear, así la base destino queda
# como estaba la origen en el momento del volcado. Nunca contra producción a
# menos que producción sea justo lo que se está recuperando.
#
# Uso: AGE_IDENTITY_FILE=~/.config/kino/backup-age.key TARGET_URL=... \
#      scripts/backup/restore.sh kino-<fecha>.dump.age
set -euo pipefail

: "${AGE_IDENTITY_FILE:?Falta AGE_IDENTITY_FILE (clave privada age)}"
: "${TARGET_URL:?Falta TARGET_URL (cadena directa de la base destino)}"
encrypted="${1:?Falta el archivo .dump.age}"

plain="$(mktemp --suffix=.dump)"
trap 'rm -f "$plain"' EXIT

start=$(date +%s)
age --decrypt --identity "$AGE_IDENTITY_FILE" --output "$plain" "$encrypted"

# --no-owner/--no-privileges: el rol de Neon (neondb_owner) no existe en un
# Postgres local y viceversa. --if-exists evita ruido en una base vacía.
pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error \
  --dbname="$TARGET_URL" "$plain"

echo "Restaurado en $(( $(date +%s) - start )) s"
