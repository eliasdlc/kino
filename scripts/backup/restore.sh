#!/usr/bin/env bash
# Restaura un snapshot cifrado sobre el deployment de CONVEX_DEPLOY_KEY y cronometra.
#
# Descifra con la clave privada age de AGE_IDENTITY_FILE e importa con
# --replace-all: el deployment queda exactamente como estaba el origen en el
# momento del volcado, y lo que no venga en el snapshot se borra. Nunca contra
# producción a menos que producción sea justo lo que se está recuperando.
#
# El nombre del deployment destino se escribe dos veces a propósito: la clave
# lo lleva delante (`prod:nombre-123|...`) y CONFIRM_TARGET tiene que repetirlo.
# Así una clave de producción pegada por error en la variable equivocada no
# borra nada.
#
# Uso: AGE_IDENTITY_FILE=~/.config/kino/backup-age.key CONVEX_DEPLOY_KEY=... \
#      CONFIRM_TARGET=<nombre del deployment> scripts/backup/restore.sh kino-<fecha>.zip.age
set -euo pipefail

: "${AGE_IDENTITY_FILE:?Falta AGE_IDENTITY_FILE (clave privada age)}"
: "${CONVEX_DEPLOY_KEY:?Falta CONVEX_DEPLOY_KEY (clave de deploy del deployment destino)}"
: "${CONFIRM_TARGET:?Falta CONFIRM_TARGET (nombre del deployment destino, tal como aparece en la clave)}"
encrypted="${1:?Falta el archivo .zip.age}"

# `prod:judicious-marmot-297|eyJ...` → judicious-marmot-297
target="${CONVEX_DEPLOY_KEY%%|*}"
target="${target#*:}"
if [ "$target" != "$CONFIRM_TARGET" ]; then
  echo "CONVEX_DEPLOY_KEY apunta a '$target' y CONFIRM_TARGET dice '$CONFIRM_TARGET'. No se restaura." >&2
  exit 1
fi

plain="$(mktemp --suffix=.zip)"
trap 'rm -f "$plain"' EXIT

start=$(date +%s)
age --decrypt --identity "$AGE_IDENTITY_FILE" --output "$plain" "$encrypted"

npx convex import --replace-all --yes "$plain"

echo "Restaurado en $target en $(( $(date +%s) - start )) s"
