#!/usr/bin/env bash
# El build de Vercel. Si el entorno trae CONVEX_DEPLOY_KEY, las funciones y el
# schema de Convex salen en el mismo despliegue que el código: `convex deploy`
# publica primero y deja NEXT_PUBLIC_CONVEX_URL puesta para `next build`, así
# que un deploy de código nunca corre contra funciones viejas. Sin la clave (los
# previews, que apuntan a un deployment ya existente por NEXT_PUBLIC_CONVEX_URL)
# se construye sólo Next.
set -euo pipefail

if [ -n "${CONVEX_DEPLOY_KEY:-}" ]; then
  exec npx convex deploy --cmd 'pnpm build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL
fi
exec pnpm build
