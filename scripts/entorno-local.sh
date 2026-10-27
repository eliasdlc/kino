#!/usr/bin/env bash
# El entorno local de un worktree: su propio backend de Convex, sus propios
# puertos y su propia semilla, con un solo script para levantarlo y apagarlo.
#
#   bash scripts/entorno-local.sh up       # backend + funciones + .env.local + semilla (la primera vez)
#   bash scripts/entorno-local.sh dev      # up, y `next dev` en el puerto de este worktree
#   bash scripts/entorno-local.sh status   # puertos, pid y si responde
#   bash scripts/entorno-local.sh down     # apaga el backend; los datos se quedan
#   bash scripts/entorno-local.sh reset    # apaga y borra datos: la próxima `up` siembra de nuevo
#   bash scripts/entorno-local.sh env      # imprime el `export` para correr `npx convex ...` contra este backend
#
# Todo lo que escribe vive en `.kino-local/` (git lo ignora) y en `.env.local`,
# que se regenera entero: ya no hay un `.env.local` copiado que apunte a un
# backend muerto. El backend es el binario que descarga la CLI de Convex, no el
# deployment compartido de dev, así que un cambio de schema aquí no toca a nadie.
set -euo pipefail

raiz="$(git rev-parse --show-toplevel)"
estado="$raiz/.kino-local"
puertos="$estado/puertos.env"
mkdir -p "$estado"
cd "$raiz"

# Las claves de Clerk son las de la instancia de desarrollo, que es compartida:
# la identidad de la cuenta sembrada no cambia por worktree.
SECRETOS="${KINO_SECRETOS:-$HOME/.config/secretos/kino.env}"
CUENTA="${KINO_CUENTA:-prueba@usekino.dev}"
CLERK_ID="${KINO_CLERK_ID:-user_3IqfSToAdAfTq2erTC9a4wNDZhx}"

ocupado() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

# Tres puertos que dependen de la ruta del worktree, para que dos sesiones no se
# pisen ni tengan que ponerse de acuerdo. Si alguno ya está tomado se corre al
# siguiente hueco. Se fijan una vez: el .env.local y el navegador cuentan con ellos.
asignar_puertos() {
  [ -f "$puertos" ] && return
  local slot
  slot=$(( $(printf '%s' "$raiz" | cksum | cut -d' ' -f1) % 100 ))
  while ocupado $((3100 + slot)) || ocupado $((3300 + slot)) || ocupado $((3500 + slot)); do
    slot=$(( (slot + 1) % 100 ))
  done
  cat >"$puertos" <<EOF
NEXT_PORT=$((3100 + slot))
CONVEX_PORT=$((3300 + slot))
SITE_PORT=$((3500 + slot))
INSTANCE_NAME=kino-local-$slot
INSTANCE_SECRET=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')
EOF
}

cargar_puertos() { asignar_puertos; set -a; . "$puertos"; set +a; }

# El binario lo descarga la CLI de Convex la primera vez que levanta un
# deployment local. Si la máquina no lo tiene, se le pide a la CLI en un
# directorio vacío, donde no hay nada que publicar.
binario() {
  local base="${XDG_CACHE_HOME:-$HOME/.cache}/convex/binaries" b
  b="$(ls -d "$base"/*/convex-local-backend 2>/dev/null | tail -1 || true)"
  if [ -z "$b" ]; then
    echo "Descargando el backend local de Convex (una vez por máquina)..." >&2
    local tmp; tmp="$(mktemp -d)"
    (cd "$tmp" && mkdir convex && echo '{}' >package.json \
      && CONVEX_AGENT_MODE=anonymous "$raiz/node_modules/.bin/convex" dev --once --typecheck disable --codegen disable >/dev/null 2>&1 || true)
    rm -rf "$tmp"
    b="$(ls -d "$base"/*/convex-local-backend 2>/dev/null | tail -1 || true)"
  fi
  [ -n "$b" ] || { echo "No pude obtener el binario de convex-local-backend." >&2; exit 1; }
  echo "$b"
}

# Las acciones `use node` (convex/account.ts, github.ts, pushSend.ts) las corre
# el backend con un Node 20, 22 o 24 que encuentre en el PATH; el 26 no sirve.
ruta_node() {
  local major; major="$(node -p 'process.versions.node.split(".")[0]')"
  case "$major" in 20|22|24) return ;; esac
  local dir
  dir="$(mise where node@24 2>/dev/null || true)"
  [ -n "$dir" ] && [ -x "$dir/bin/node" ] && { echo "$dir/bin"; return; }
  echo "El backend local necesita Node 20, 22 o 24 para las acciones \`use node\` (hay $major). Instala uno: mise install node@24" >&2
  exit 1
}

responde() { curl -sf --max-time 2 "http://127.0.0.1:$CONVEX_PORT/version" >/dev/null; }

pid_vivo() { [ -f "$estado/backend.pid" ] && kill -0 "$(cat "$estado/backend.pid")" 2>/dev/null; }

clave_admin() { "$(binario)" keygen admin-key --instance-name "$INSTANCE_NAME" --instance-secret "$INSTANCE_SECRET"; }

exportar_convex() {
  export CONVEX_SELF_HOSTED_URL="http://127.0.0.1:$CONVEX_PORT"
  CONVEX_SELF_HOSTED_ADMIN_KEY="$(clave_admin)"; export CONVEX_SELF_HOSTED_ADMIN_KEY
}

leer_secreto() { grep -m1 "^$1=" "$SECRETOS" | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }

arrancar_backend() {
  if pid_vivo && responde; then return; fi
  local b nodebin; b="$(binario)"; nodebin="$(ruta_node)"
  nohup env PATH="${nodebin:+$nodebin:}$PATH" "$b" \
    --interface 127.0.0.1 --port "$CONVEX_PORT" --site-proxy-port "$SITE_PORT" \
    --instance-name "$INSTANCE_NAME" --instance-secret "$INSTANCE_SECRET" \
    --local-storage "$estado/storage" --disable-beacon \
    "$estado/db.sqlite3" >"$estado/backend.log" 2>&1 &
  echo $! >"$estado/backend.pid"
  for _ in $(seq 1 240); do responde && return; sleep 0.5; done
  echo "El backend no respondió en 120 s; mira $estado/backend.log" >&2
  exit 1
}

# `.env.local` completo, regenerado. Next lee NEXT_PUBLIC_CONVEX_URL; la CLI de
# Convex lee las dos CONVEX_SELF_HOSTED_*. El PORT no lo honra `next dev` desde
# el archivo, por eso existe `dev` en este script.
escribir_env() {
  [ -f "$SECRETOS" ] || { echo "Falta $SECRETOS (claves de Clerk de desarrollo)." >&2; exit 1; }
  cat >"$raiz/.env.local" <<EOF
# Generado por scripts/entorno-local.sh; se regenera en cada \`up\`.
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:$CONVEX_PORT
NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:$SITE_PORT
CONVEX_SELF_HOSTED_URL=http://127.0.0.1:$CONVEX_PORT
CONVEX_SELF_HOSTED_ADMIN_KEY="$CONVEX_SELF_HOSTED_ADMIN_KEY"
NEXT_PUBLIC_APP_URL=http://localhost:$NEXT_PORT
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$(leer_secreto NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
CLERK_SECRET_KEY=$(leer_secreto CLERK_SECRET_KEY)
KINO_MCP_SIGNING_JWK='$(cat "$estado/mcp-jwk.json" 2>/dev/null || true)'
EOF
  chmod 600 "$raiz/.env.local"
}

# El emisor de Clerk sale de la clave publicable: pk_test_<base64 del host>$.
configurar_deployment() {
  local pk host
  pk="$(leer_secreto NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)"
  host="$(printf '%s' "${pk#pk_*_}" | base64 -d 2>/dev/null | tr -d '$\0')"
  [ -n "$host" ] || { echo "No pude derivar el emisor de Clerk de la clave publicable." >&2; exit 1; }
  npx convex env set CLERK_JWT_ISSUER_DOMAIN "https://$host" >/dev/null
  # Sin nadie a quien notificar, como el deployment de dev. Para ejercitar un
  # cron: npx convex run scheduler:taskReminders
  npx convex env set KINO_CRONS_APAGADOS true >/dev/null
  # El conector MCP firma con una clave propia de este worktree: la privada va a
  # .env.local (Next) y la pública, como JWKS, al backend. Sin KINO_MCP_JWKS la
  # CLI se niega a publicar `auth.config.ts`.
  [ -f "$estado/mcp-jwk.json" ] || node --input-type=module -e "
    import { generateKeyPair, exportJWK } from 'jose';
    const { privateKey } = await generateKeyPair('ES256', { extractable: true });
    console.log(JSON.stringify(await exportJWK(privateKey)));" >"$estado/mcp-jwk.json"
  local jwks
  jwks="$(node -e "
    const { d, ...pub } = JSON.parse(require('fs').readFileSync('$estado/mcp-jwk.json', 'utf8'));
    const jwks = { keys: [{ ...pub, kid: 'kino-mcp', alg: 'ES256', use: 'sig' }] };
    console.log('data:application/json;base64,' + Buffer.from(JSON.stringify(jwks)).toString('base64'));")"
  npx convex env set KINO_MCP_JWKS "$jwks" >/dev/null
}

# El primer análisis de módulos tras arrancar el backend es lento y puede pasar
# los 4 s que Convex da a cada función; el siguiente ya viene en caliente. Por
# eso el push se reintenta antes de dar el entorno por roto.
publicar_funciones() {
  for intento in 1 2 3; do
    npx convex dev --once --typecheck disable --codegen disable >"$estado/push.log" 2>&1 && return
    echo "push de funciones, intento $intento fallido" >&2
  done
  grep -v 'Warning\|trace-warnings' "$estado/push.log" | tail -8 >&2
  exit 1
}

sembrar() {
  [ -f "$estado/sembrado" ] && return
  local id; id="{\"subject\":\"$CLERK_ID\",\"issuer\":\"https://clerk.dev\",\"email\":\"$CUENTA\"}"
  npx convex run users:ensure '{}' --identity "$id" >/dev/null
  npx convex run onboarding:complete '{"identity":"estudiante"}' --identity "$id" >/dev/null
  KINO_CLERK_ID="$CLERK_ID" node scripts/capturas/sembrar.mjs
  touch "$estado/sembrado"
}

subir() {
  [ -d node_modules ] || { echo "Falta pnpm install." >&2; exit 1; }
  cargar_puertos
  arrancar_backend
  exportar_convex
  configurar_deployment
  escribir_env
  publicar_funciones
  sembrar
  echo "Convex   http://127.0.0.1:$CONVEX_PORT  (acciones HTTP en $SITE_PORT)"
  echo "Next     http://localhost:$NEXT_PORT   (bash scripts/entorno-local.sh dev)"
  echo "Cuenta   $CUENTA"
}

case "${1:-}" in
  up) subir ;;
  dev) subir; exec npx next dev -p "$NEXT_PORT" ;;
  status)
    cargar_puertos
    echo "next $NEXT_PORT, convex $CONVEX_PORT, site $SITE_PORT"
    if pid_vivo && responde; then echo "backend: arriba (pid $(cat "$estado/backend.pid"))"; else echo "backend: apagado"; fi ;;
  down)
    if pid_vivo; then kill "$(cat "$estado/backend.pid")"; echo "backend apagado"; fi
    rm -f "$estado/backend.pid" ;;
  reset)
    "$0" down
    rm -rf "$estado/db.sqlite3"* "$estado/storage" "$estado/sembrado" ;;
  env) cargar_puertos; exportar_convex
    echo "export CONVEX_SELF_HOSTED_URL=$CONVEX_SELF_HOSTED_URL CONVEX_SELF_HOSTED_ADMIN_KEY=\"$CONVEX_SELF_HOSTED_ADMIN_KEY\"" ;;
  *) sed -n '2,11p' "$0"; exit 2 ;;
esac
