#!/usr/bin/env bash
# El test del check de voz. Cada regla se comprueba dos veces: contra una línea
# que tiene que atrapar y contra una que tiene que dejar pasar.
#
# Existe porque un grep mal escrito no falla: deja de encontrar y se pone verde,
# que es la única forma en que un check así se rompe.
#
#   bash scripts/check-voz.test.sh
#
set -uo pipefail
raiz_repo="$(cd "$(dirname "$0")/.." && pwd)"

fallos=0

# Corre el check sobre un árbol de un solo fichero. `$1` qué se prueba,
# `$2` "atrapa" o "pasa", `$3` la ruta relativa, `$4` el contenido.
caso() {
  local que="$1" espera="$2" ruta="$3" contenido="$4"
  local tmp
  tmp=$(mktemp -d)
  mkdir -p "$tmp/$(dirname "$ruta")" "$tmp/convex" "$tmp/scripts"
  printf '%s\n' "$contenido" > "$tmp/$ruta"

  local salida estado
  salida=$(CHECK_VOZ_RAIZ="$tmp" bash "$raiz_repo/scripts/check-voz.sh")
  estado=$?
  rm -rf "$tmp"

  if [ "$espera" = "atrapa" ] && [ "$estado" -eq 0 ]; then
    echo "FALLO: $que — debía atrapar y pasó"
    fallos=$((fallos + 1))
  elif [ "$espera" = "pasa" ] && [ "$estado" -ne 0 ]; then
    echo "FALLO: $que — debía pasar y atrapó:"
    echo "$salida"
    fallos=$((fallos + 1))
  fi
}

caso "tipo en JSX visible" atrapa src/a.tsx '<Label>SprintTransport</Label>'
caso "firma con genéricos" pasa src/a.tsx 'function f(p: React.ComponentProps<"div"> & VariantProps<typeof v>) {}'

caso "guion largo en copy" atrapa src/a.tsx '<p>Vas al día — te sobran dos</p>'
caso "guion largo en comentario" atrapa src/a.ts '// el plan del día — lo que queda'
caso "guion corto" pasa src/a.tsx '<p>Vas al día - te sobran dos</p>'

caso "emoji" atrapa src/a.tsx 'const l = "🔥 Alta";'
caso "glifo de tilde" atrapa src/a.tsx '<span>Todas tienen fecha ✓</span>'
caso "flecha de mapeo" pasa src/a.ts '// null → tag global del usuario'

caso "Kino de sujeto" atrapa src/a.tsx '<p>Kino te avisa cuando pasas del techo</p>'
caso "Kino de sujeto, otra forma" atrapa src/a.tsx '<span>Kino sugiere para hoy</span>'
caso "Kino de objeto" pasa src/a.tsx '<p>Crea una tarea en Kino</p>'
caso "Kino de sujeto en marketing" pasa src/features/marketing/a.tsx '<p>Kino te avisa</p>'

caso "palabra prohibida" atrapa src/a.tsx '<p>Tus sistemas de productividad</p>'
caso "palabra prohibida en marketing" pasa src/features/marketing/a.tsx '<p>Un coach, no un robot</p>'
caso "palabra prohibida en un test" pasa src/a.test.tsx 'expect(t).toBe("coach");'

if [ "$fallos" -gt 0 ]; then
  echo "check-voz.test: $fallos casos mal"
  exit 1
fi

echo "check-voz.test: los 15 casos como se esperaba"
