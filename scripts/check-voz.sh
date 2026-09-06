#!/usr/bin/env bash
# La voz del producto, comprobada con grep.
#
# Los defectos que atrapa comparten forma: ninguno rompe el typecheck, ninguno
# rompe un test, y los cinco los ve un usuario a la primera. El más caro entró
# en un PR de 208 ficheros que estuvo abierto nueve minutos con los tests en
# verde.
#
# Falla en rojo, no avisa: un check que avisa se ignora en la segunda semana.
# Las excepciones se declaran aquí, por ruta y con su motivo, nunca con
# comentarios de desactivación esparcidos por el código.
#
#   bash scripts/check-voz.sh          # todo el repo
#
# `CHECK_VOZ_RAIZ` apunta a otro árbol con la misma forma (`src/`, `convex/`,
# `scripts/`). Existe para que `check-voz.test.sh` compruebe cada regla contra
# un caso que debe fallar y otro que debe pasar, y el check no se rompa en
# silencio.
#
set -uo pipefail
cd "${CHECK_VOZ_RAIZ:-$(dirname "$0")/..}"

hallazgos=0

# Imprime cada línea encontrada y las suma. El conteo se lleva aquí y no en una
# tubería a propósito: una función al final de un `|` corre en un subshell y el
# contador vuelve a cero sin que nada lo diga.
reportar() {
  local regla="$1" encontrado="$2"
  [ -n "$encontrado" ] || return 0
  echo "── $regla"
  echo "$encontrado"
  echo
  hallazgos=$((hallazgos + $(echo "$encontrado" | wc -l)))
}

# El catálogo visual de `/system-design` enseña primitivas fuera de contexto y
# los ficheros de test escriben a propósito el texto que la regla prohíbe.
COMUNES=(--include=*.ts --include=*.tsx
         --exclude-dir=system-design
         --exclude=*.test.ts --exclude=*.test.tsx)

# Las dos carpetas de marketing: el slice y su grupo de rutas. `--exclude-dir`
# compara el nombre exacto, así que `(marketing)` va escrito aparte.
MARKETING=(--exclude-dir=marketing --exclude-dir='(marketing)')

# ── 1. Un nombre de tipo dentro de texto que se ve
#
# `<Label>SprintTransport</Label>`: un renombrado mecánico que cruzó de los
# tipos al copy. Sólo mira nodos de texto sin puntuación, así que una firma
# como `React.ComponentProps<"div"> & VariantProps<...>` no cae aquí.
reportar "Nombre de tipo dentro de texto visible" "$(
  grep -rnP '>[A-Za-zÀ-ÿ0-9 ]*[A-Z][A-Za-z0-9]*(Transport|Schema|Dto|Props|Row|Doc|Id)[A-Za-zÀ-ÿ0-9 ]*<' \
    src "${COMUNES[@]}"
)"

# ── 2. Guion largo
#
# En todas partes, no sólo en copy: la casa no lo usa ni en comentarios ni en
# los tres Markdown del repo. `check-voz.test.sh` queda fuera porque lleva a
# propósito las cadenas que las reglas prohíben.
reportar "Guion largo (U+2014)" "$(
  grep -rnP '\x{2014}' src convex scripts AGENTS.md README.md \
    "${COMUNES[@]}" --include=*.sh --include=*.md --exclude=*.test.sh 2>/dev/null
)"

# ── 3. Emojis y glifos decorativos
#
# `AGENTS.md`: sin emojis, texto o iconos lucide. Las flechas (U+2190-21FF) no
# entran: en los comentarios son notación de mapeo (`null → global`), no adorno.
reportar "Emoji o glifo decorativo" "$(
  grep -rnP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}\x{FE0F}]' \
    src convex "${COMUNES[@]}" 2>/dev/null
)"

# ── 4 y 6. Kino de sujeto, y la regla madre
#
# El producto le habla a la persona; la persona es el sujeto. Un producto que
# se pone de sujeto ("Kino te avisa") se está atribuyendo la acción. La regla
# madre es la misma en general: `Kino` seguido de un verbo conjugado.
#
# Excepciones:
#   features/marketing  la voz de la landing la cierra *Aplicar el vocabulario
#                       decidido y la palabra de la categoría* (fase 12).
#   features/mcp        esas cadenas son el contrato que lee el agente, no copy
#                       que lee una persona; las cierra *Retirar las dieciséis
#                       tools y acotar el alcance de la clave* (fase 5).
reportar "Kino como sujeto de la frase" "$(
  grep -rnPi '\bKino (te |se |no te |ya |todavía |siempre |nunca )?(avisa|avisará|frena|sugiere|sabe|conoce|ordena|empuja|reserva|dice|dijo|aprende|aprendió|detecta|decide|elige|piensa|entiende|recuerda|encarga|envía|enviará|está aprendiendo)' \
    src "${COMUNES[@]}" "${MARKETING[@]}" --exclude-dir=mcp
)"

# ── 5. Las cuatro palabras prohibidas
#
# Excepciones, las mismas dos de arriba y por el mismo motivo, más
# `features/insights` y `DashboardBottomRow`, que son el panel que disuelve
# *Reescribir la salida del sobregiro y disolver el advisor* (fase 6).
reportar "Palabra prohibida (coach, productividad, asistente, detectamos)" "$(
  grep -rnEi '\b(coach|productividad|asistente|detectamos)' \
    src "${COMUNES[@]}" "${MARKETING[@]}" \
    --exclude-dir=insights --exclude=DashboardBottomRow.tsx
)"

if [ "$hallazgos" -gt 0 ]; then
  echo "check-voz: $hallazgos hallazgos"
  exit 1
fi

echo "check-voz: limpio"
