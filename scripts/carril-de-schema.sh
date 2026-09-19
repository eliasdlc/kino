#!/usr/bin/env bash
# El carril único de schema, como puerta de CI.
#
# Todos los previews publican sus funciones contra el mismo deployment de dev,
# así que un PR que cambia `convex/schema.ts` cambia el schema que ven todos
# los demás PRs abiertos. La regla del repo es que un cambio de schema va solo:
# este paso falla el build de un PR que toca el schema mientras haya otro PR
# abierto, y no hace nada en los demás casos.
#
# Uso, desde el job de CI de un pull_request:
#   bash scripts/carril-de-schema.sh <numero-del-pr> <sha-de-la-base>
# Necesita `gh` autenticado (GH_TOKEN) y el repo con la base alcanzable.
set -euo pipefail

pr="${1:?numero del PR}"
base="${2:?sha de la base}"

git fetch --quiet --depth=1 origin "$base"
if ! git diff --name-only "$base" HEAD | grep -qx 'convex/schema.ts'; then
  echo "carril de schema: este PR no toca convex/schema.ts"
  exit 0
fi

otros="$(gh pr list --state open --json number --jq "[.[].number | select(. != $pr)] | join(\", \")")"
if [ -n "$otros" ]; then
  echo "carril de schema: este PR cambia convex/schema.ts y hay otros PRs abiertos (#$otros)."
  echo "Un cambio de schema va solo: espera a que se fusionen o se cierren, y relanza el build."
  exit 1
fi

echo "carril de schema: libre, este PR es el único abierto"
