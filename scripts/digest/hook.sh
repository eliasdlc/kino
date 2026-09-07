#!/usr/bin/env bash
# El hook del diario de sesiones. Ver `scripts/digest/hook.ts`.
#
# Existe como shell y no como llamada directa a `tsx` porque es lo que
# `~/.claude/settings.json` referencia: un hook que se cae no puede tumbar el
# cierre de una sesión, así que aquí se traga el fallo y se anota.
set -uo pipefail
cd "$(dirname "$0")/../.."

if [ "${1:-}" = "--install" ]; then
  exec node --experimental-strip-types scripts/digest/install.mts
fi

if ! pnpm exec tsx scripts/digest/hook.ts "$@"; then
  echo "digest: la subida falló. No bloquea nada." >&2
  exit 0
fi
