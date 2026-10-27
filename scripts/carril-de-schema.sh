#!/usr/bin/env bash
# El aviso de schema, informativo: nunca falla el job.
#
# Cada worktree corre su propio backend de Convex (scripts/entorno-local.sh), así
# que un cambio en `convex/schema.ts` ya no choca con el de otro PR mientras se
# desarrolla. Lo que sigue pudiendo chocar es el merge: dos PRs que editan el
# mismo schema se pisan al integrarse. Este paso lo dice en el log del job con
# una anotación de GitHub y termina en verde en cualquier caso.
#
# Uso, desde el job de CI de un pull_request:
#   bash scripts/carril-de-schema.sh <numero-del-pr> <sha-de-la-base>
# Necesita `gh` autenticado (GH_TOKEN) y el repo con la base alcanzable.
set -euo pipefail

pr="${1:?numero del PR}"
base="${2:?sha de la base}"

git fetch --quiet --depth=1 origin "$base"
if ! git diff --name-only "$base" HEAD | grep -qx 'convex/schema.ts'; then
  echo "schema: este PR no toca convex/schema.ts"
  exit 0
fi

# Si la consulta falla (permisos del token, límite de la API) el aviso se pierde,
# pero el job no: es informativo.
otros="$(gh pr list --state open --json number,files \
  --jq "[.[] | select(.number != $pr) | select(any(.files[]; .path == \"convex/schema.ts\")) | .number] | map(\"#\" + tostring) | join(\", \")" \
  2>/dev/null || true)"

if [ -n "$otros" ]; then
  echo "::notice title=Schema::Este PR y $otros editan convex/schema.ts. Cada uno corre en su backend local, pero al integrarse el segundo en entrar resuelve el conflicto sobre el schema del primero."
  echo "schema: también lo editan $otros (informativo, no bloquea)"
else
  echo "schema: este PR toca convex/schema.ts y ningún otro PR abierto lo toca"
fi
exit 0
