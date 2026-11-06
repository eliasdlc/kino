# Kino

## What it is

Instrumento de planificación construido alrededor de la gestión de energía cognitiva y sistemas basados en identidad. Fullstack Next.js 16 (App Router), 100% serverless, con Convex como base y Clerk como identidad.

Lo que no se rompe, y por qué:

- **$0/mes de infraestructura**, dentro de los free tiers de Vercel y Convex. Sin Redis, BullMQ ni servidor persistente.
- **La sesión la emite y la revoca Clerk.** Kino no guarda sesiones propias ni acepta otro token de navegador, para que cerrar una sesión desde el panel la corte de verdad.
- **Lo reversible se escribe, lo que suplanta tu voz se propone, y lo irreversible o lo que toca credenciales no se toca desde un agente.** Es el principio de la casa y lo aplica `convex/lib/fn.ts`.
- **Una fuente conectada entrega capturas, nunca tareas** (salvo `pva` y `github`). Una fuente nueva que escriba tareas necesita una decisión de Elias.
- **Kino nunca escribe en GitHub** ni manda el texto de un documento a ningún modelo.
- No existe código de pagos: `subscriptionStatus` y `planType` son placeholders. No implementar guards de Premium.

Los planes, el estado y el orden de trabajo viven en Zoho Projects (portal `eliasdlc2005gmaildotcom`, proyecto `Kino`, prefijo `KI1-T`), no en este repo. Las fases son la fuente de verdad de qué se construye y por qué; el índice de decisiones está en `~/Documents/Proyectos/Kino/dev/Kino-DECISIONS.md`. En este repo solo se aceptan tres Markdown: `README.md`, `AGENTS.md` y `DESIGN.md` (contrato de identidad visual). Ningún plan, audit ni análisis; las notas locales van a `~/Documents/Kino/dev/`.

## Owner's note

To fill in by Elias.

## Glossary

- Bandeja: el sistema `systems.inbox`, adonde cae todo lo que no dice a qué sistema pertenece.
- Sistema: contenedor de tareas, carpetas, páginas y notas; tiene un `systemType` (arquetipo) que fija su vocabulario.
- Arquetipo: el comportamiento de un `systemType`, declarado en `src/shared/lib/system-types.ts`.
- Captura: lo que entrega una fuente conectada y espera en Bandeja hasta que una persona decide si es tarea (`convex/captures.ts`).
- Alcance (`kino_scope`): lo que un token del conector MCP puede hacer: `readOnly`, `direct`, `proposed` o `closed`.
- Conector MCP: la única entrada MCP viva, `/api/mcp`, con OAuth de Clerk.
- Expand y contract: la regla de migraciones: el campo nace opcional, se rellena, todo escritor lo escribe, y sólo en otro deploy se vuelve obligatorio.
- Borrado blando: `deletedAt` en `tasks`, `folders`, `pages`, `stickyNotes` y `entities`.
- Prioridad efectiva: la prioridad elegida subida por cercanía de la fecha (`src/shared/lib/effective-priority.ts`); no se escribe en la base.
- Resumen de la mañana: el digest diario de recordatorios (`morningDigestTime`, 08:00 por defecto).
- Specimen: el ejemplo de un componente en `/system-design`.
- `SIN_TOOL`: la lista de funciones de Convex que existen y no se exponen por MCP, cada una con su motivo.

## Facts

- production: https://www.usekino.dev
- production branch: main (Vercel); `dev` produce previews
- preview: Vercel previews de PRs y de `dev`, contra el deployment de dev de Convex
- deploy: Vercel + Convex. `scripts/vercel-build.sh` corre `npx convex deploy --cmd 'pnpm build'` si hay `CONVEX_DEPLOY_KEY`; ninguna laptop tiene la clave de producción
- convex: dos deployments del mismo proyecto, `prod` y dev; cada uno con su instancia de Clerk (`pk_live_`/`sk_live_` y `pk_test_`/`sk_test_`)
- backup: `.github/workflows/backup.yml`, 05:23 UTC, a Cloudflare R2 cifrado con `age`, retención 30 días; la clave privada `age` vive en el gestor de contraseñas de Elias
- zoho: portal `eliasdlc2005gmaildotcom`, proyecto `Kino`, prefijo `KI1-T`
- package manager: pnpm (no npm, no yarn)

## Ways to hurt yourself

1. **Superar el free tier.** Cada función corre en 10 s (`DEFAULT_BUDGET_MS` en `convex/lib/fn.ts`; `kinoAction(30_000)` es la única excepción, y `export const maxDuration` en Next: los dos ZIP en 10 s, `/api/mcp` en 60 s). Subir un límite es una decisión escrita en el comentario de la función. Las lecturas nuevas que puedan crecer nacen acotadas como `tasks.list` y `pages.bySystem` (`{ items, restantes }`, `TASK_LIST_LIMIT`, `PAGE_LIST_LIMIT`). Ninguna pantalla usa `refetch` por tiempo.
2. **Una query sin rango.** Cada `useConvexQuery` es una suscripción: una query que lee 300 documentos los relee en cada escritura, por cada pestaña. Un `.collect()` sobre una tabla entera o sobre un índice que sólo fija el usuario lleva el motivo escrito al lado. Sólo valen dos casos: tabla acotada por construcción (`pushSubscriptions`) y poda por lotes que se reprograma sola (`convex/podas.ts`). Así se fue el 93,7% de Database I/O del plan gratuito.
3. **Un schema que Convex rechaza.** Convex valida el schema contra los documentos existentes: un campo obligatorio con una sola fila sin él rechaza el deploy. Expand y contract en dos deploys, nunca a la vez, y el cambio tiene que ser compatible hacia atrás con el código ya desplegado. Contra producción las migraciones **nunca se corren a mano**: las publica el `convex deploy` del build, y correrlas es una decisión aparte con el respaldo del día delante.
4. **Fechas.** Es el gotcha número uno. Todo "hoy", `dueDate`, slots y "vencidas" pasa por `src/shared/time` (y `convex/lib/time.ts` en servidor); está prohibido reimplementar "hoy en la timezone del usuario". `dueDate` y `startDate` son instantes con hora opcional en milisegundos: un día sin hora es medianoche del navegador desde la app y de UTC desde MCP o seeds, y `parseTaskDay` lee las dos (cuidado con el off-by-one). `dayToLocalISO` vive en `src/features/tasks/tasks.utils.ts`. El cálculo de negocio se hace en el servidor.
5. **Una ruta de Next no hereda el modelo de alcances.** El envoltorio de `convex/lib/fn.ts` resuelve identidad y `kino_scope`; una ruta (o ruta HTTP de `convex/http.ts`) que no llama a Convex por él no pasa por ninguna. Toda ruta fuera de Convex comprueba a mano quién llama o escribe en su comentario por qué no hace falta: exports, uploads y connect/callback de GitHub exigen sesión de navegador (un token MCP trae `userId` y nunca `sessionId`, y `export.test.ts` lo prueba); `/api/mcp` verifica el token de Clerk con `@clerk/mcp-tools`; `/push/accion` exige un enlace firmado con HMAC (`convex/lib/firmaAccion.ts`) y sólo abre tres acciones reversibles. Comprobar la sesión no es comprobar el alcance.
6. **El alcance lo decide la función, no el token.** Se declara eligiendo el constructor de `convex/lib/fn.ts` (`kinoQuery` readOnly; `kinoMutation` y `kinoAction()` direct; `kinoProposal` proposed; `kinoClosed` y `kinoAction(ms, 'closed')` sólo navegador). El tipo generado de `api.*` no conserva la marca: `convex/reach.test.ts` es la comprobación, no el compilador. Quitarlo deja la regla sin sostén.
7. **Una fila flotante o un borrado que destruye.** Todo lo que vive en un sistema lleva `systemId` (en `folders`, `pages`, `stickyNotes` y `pageSnapshots` sigue opcional a mitad de expand y contract: todo escritor ya lo escribe, y volverlo obligatorio es otro deploy). El borrado blando excluye los borrados en toda lectura salvo la papelera (índices `by_*_alive`). Una cascada blanda marca sólo a los hijos con `deletedAt` y deja intacto lo que se alcanza por el padre, porque `restore` tiene que devolver la cosa entera. Excepciones: derivadas (`pageEntityMentions`) se borran; `tags.remove` destruye; `systems.remove` archiva (`isActive: false`); `users.purge` es el único borrado duro.
8. **Creer que el respaldo corre.** `backup.yml` sólo respalda si el workflow está en `main` (GitHub dispara `schedule:` sólo desde la rama por defecto) y los seis secretos están cargados (`CONVEX_DEPLOY_KEY` de producción, empieza por `prod:`, `BACKUP_AGE_RECIPIENT`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`). Compruébalo con `gh run list --workflow=backup.yml`; sin ejecuciones, el único respaldo son los snapshots de la propia cuenta de Convex. La clave privada `age` es el único secreto que no se puede rotar sin invalidar lo guardado. Pasar de los 10 GB gratis de R2 es una decisión.
9. **Hablarle REST a Kino.** La API REST ya no existe. Un cliente que llame `https://www.usekino.dev/api/<lo que sea>` no recibe 404 de API sino el HTML de la página 404 de la app (le pasa al MCP por URL de `~/.claude.json` de Elias). La única entrada MCP viva es `/api/mcp`. Los errores de dominio están en `convex/lib/errors.ts` (`NOT_FOUND`, `VALIDATION_ERROR`, `FORBIDDEN`, `CONFLICT`, `CONFIRMATION_REQUIRED`, como `ConvexError`).

## Surfaces

Un cambio que toca una de estas pide revisar las otras:

- **Tabla nueva:** `convex/schema.ts`, un test por tabla, su línea en la retención de abajo, y su cascada de borrado si lo necesita (`scripts/migrate-to-convex/cascadas.ts`, que un test mantiene igual al schema de Drizzle).
- **Variable de entorno nueva:** `.env.example` en el mismo commit que la lee, y `npx convex env set` en cada deployment que la necesite. Cada deployment lleva `CLERK_JWT_ISSUER_DOMAIN`, `CLERK_WEBHOOK_SIGNING_SECRET`, `KINO_CRONS_APAGADOS` (sólo apaga, nunca enciende), `KINO_MCP_JWKS`, `ENCRYPTION_KEY`, el par VAPID, `RESEND_API_KEY`, `RESEND_FROM` y `KINO_APP_URL`.
- **Función de Convex nueva:** su constructor de alcance, y clasificarla en `src/features/mcp/tools/catalog.ts` (`readTool`, `proposeTool` o `writeTool`, con su `ref` y `perfil`) o en `SIN_TOOL` con su motivo. Ningún test obliga a lo segundo; es parte de escribirla. `catalog.test.ts` fija la lista de nombres como contrato visible.
- **Escritura que cambie fecha, estado o intensidad de una tarea:** llama a `recalcularAviso` (y un cambio de zona, silencio o intensidad en Ajustes, a `recalcularAvisosDe`). El cron sólo lee `tasks.by_nextReminder` y `userSettings.by_nextDigest`; si se olvida, el resumen de la mañana repara al día siguiente, pero eso es la red, no el diseño.
- **Texto libre nuevo:** lleva `.max()` con su cifra y motivo (`PAGE_CONTENT_MAX` 500.000, `TASK_DESCRIPTION_MAX` 10.000, `TEXT_ANCHOR_MAX` 2.000). El tope es de escritura: lo ya guardado se lee igual.
- **Tabla que caduca:** su fila en Retenciones, abajo; sin ella está incompleta.
- **Fuente conectada nueva:** `src/features/connections/providers.ts` (su test falla si un tercero declara que entrega tareas) y captura vía `ingerirCaptura`, idempotente por `(userId, source, externalId)`.
- **Arquetipo o medium nuevo:** una entrada en `src/shared/lib/system-types.ts` o `src/shared/lib/mediums.ts`, no un fork de código. El manifiesto gobierna lo que el editor ofrece, no lo que el schema admite.
- **Cambio de UI:** su specimen en `/system-design`, `loading.tsx` y `error.tsx` por ruta, y la vista móvil (`*MobileView`, `ResponsiveDialog`).
- **Cambio de voz, bundle o auth:** `pnpm check:voz`, `pnpm check:bundle` y `pnpm check:auth-production`.

Retenciones, quién poda cada tabla que caduca:

| Tabla | Retención | Quién la dispara |
|---|---|---|
| `eventLog` | 30 días desde `occurredAt` | cron `event-log-prune`, lotes de 1.000 (`convex/eventLog.ts`) |
| `itemLinks` | 30 días desde `lastSeenAt` | el mismo cron, cuando exista quien las escriba |
| `proposals` | 14 días desde `expiresAt` | nadie: pasan a `expired` al mirarlas |
| `captures` | 48 h sin confirmar | caducan con aviso; el blob se va con la fila |
| `systemMembers`, `systemInvites`, `sessionDigests`, `interruptions`, `academicPeriods`, `pageReviews`, `pageComments` | no se podan | estado y rastro, no historia; lo acotado es la lectura (`convex/lib/reviews.ts`) |
| `cronRuns` | ver `convex/cronRuns.ts` | el snapshot diario |

## Run and verify

```bash
pnpm install
pnpm dev                              # http://localhost:3000, contra el deployment de dev de .env.local
npx convex dev                        # publica las funciones en dev y regenera convex/_generated
pnpm typecheck && pnpm lint           # después de cualquier cambio; 0 errores
pnpm test                             # lógica pura (src), convex-test (convex) y jsdom (*.test.tsx)
pnpm test -- --run <path>             # un solo archivo
pnpm check:voz                        # cinco reglas de grep sobre la voz del producto
pnpm build && pnpm check:bundle       # el JavaScript al navegador contra su tope
python3 -m unittest discover -s scripts/tests -v
npx convex run migrations/<fichero>:run   # migración contra dev; la cabecera del fichero dice qué rellena
```

Antes de un PR: `pnpm typecheck && pnpm lint && pnpm test`, y la suite de Python. Si algo falla se arregla antes de commitear.

**Sesión de pruebas (headless).** Usuario sembrado `prueba@usekino.dev`, `pnpm dev` en el puerto 3000. Pide un sign-in token a Clerk: `POST /v1/sign_in_tokens` con `CLERK_SECRET_KEY` desde `~/.config/secrets/kino.env` (exportado con `set -a`, nunca impreso). En la página: `Clerk.client.signIn.create({ strategy: "ticket", ticket })` y `Clerk.setActive`. Entra sólo con el token: el formulario de contraseña cae en la pantalla de client-trust de Clerk en headless.

**Verificar mirando.** `node scripts/capturas/run.mjs` (con `pnpm dev` corriendo) captura las 19 rutas y el catálogo `/system-design` con la cuenta sembrada a 393x852, 430x748, 1131x686 y 1440x900, en claro y oscuro; `scripts/capturas/sembrar.mjs` le da densidad a esa cuenta en el deployment de dev. Nada visible se da por hecho sin esas capturas.

**Tests.** Un test de función vale lo que vale su versión rota: si invertir la condición deja la batería verde, no probaba nada. Todo `.test.tsx` renderiza desde `@/shared/testing/render` (`renderWithProviders`, `renderMobile`, `makeTestConvexClient`) y finge `next/navigation` desde `@/shared/testing/navigation`; los polyfills de jsdom viven en `src/shared/testing/jsdom-setup.ts` con el componente que los llama. Un `.test.tsx` abre con un comentario de tres a cinco líneas con el criterio que prueba, y usa aserciones de `jest-dom`, nunca `toBeDefined()`. `pnpm test:coverage` imprime el número; no hay umbral.

**Restaurar un respaldo** (`restore.sh` importa con `--replace-all`: el deployment queda como el snapshot y lo que no venga en él se borra). Exige el nombre del deployment dos veces (dentro de la clave y en `CONFIRM_TARGET`). Ensáyalo contra dev (`dev:` en la clave) o un preview.

```bash
age --version && npx convex --version
export AGE_IDENTITY_FILE=~/.config/kino/backup-age.key   # la del gestor de contraseñas
export AWS_ACCESS_KEY_ID=...  AWS_SECRET_ACCESS_KEY=...  AWS_DEFAULT_REGION=auto
export R2_ENDPOINT="https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com"
aws s3 ls "s3://<R2_BUCKET>/" --endpoint-url "$R2_ENDPOINT" | sort | tail -5   # el más reciente al final
aws s3 cp "s3://<R2_BUCKET>/kino-<fecha>.zip.age" . --endpoint-url "$R2_ENDPOINT"
scripts/backup/verify.sh kino-<fecha>.zip.age > origen.txt
export CONVEX_DEPLOY_KEY='prod:<nombre>|...'
export CONFIRM_TARGET=<nombre>
scripts/backup/restore.sh kino-<fecha>.zip.age            # imprime el tiempo de caída real
npx convex export --include-file-storage --path despues.zip
scripts/backup/verify.sh despues.zip > destino.txt
diff origen.txt destino.txt                               # sin salida = restauración completa
```

Lo que no vuelve con el snapshot son las funciones programadas en vuelo: los crons se registran solos en el siguiente `convex deploy`. En un desastre real el `diff` sigue valiendo porque la huella sale del propio fichero.

Lo que sólo la persona o un dispositivo puede mostrar: notificaciones push y sus botones en un teléfono real, la hoja de compartir del service worker (`worker/index.js`) y el modo sin red (`/offline`). Una mutación hecha sin red la retiene el cliente de Convex en memoria; no hay cola persistente.

## Pull requests

- Ramas: `main` → `dev` → rama de tarea. `main` es la rama de producción de Vercel; toda rama de tarea sale de `origin/dev` actual y entra a `dev`; un release promueve `dev` a `main` en otro PR. No se borran ramas.
- Checks requeridos en `dev` y `main`: `typecheck · lint · test`, `presupuesto de JavaScript` y `branch-model`. `branch-model.yml` corre código base confiable en `pull_request_target`, nunca ejecuta código del PR, y falla toda ruta que no sea tarea a `dev` o `dev` a `main`. Se comprueba local con `python3 scripts/delivery.py check-branch NUMBER`.
- No hay gate de aceptación del dueño: el agente mergea cuando se cumplen los criterios del skill `development-workflow` y deja a Elias lo que necesita su ojo. La rama `delivery-events` y su ruleset son archivo de lectura de decisiones pasadas; nada escribe ahí.
- Tras mergear un release a `main`, verificar producción: `python3 scripts/delivery.py production --pr RELEASE_PR_NUMBER`, luego con `--publish` (añade un commit status y el recibo en el PR; no despliega), y `pnpm check:auth-production`. Exige un PR `dev` a `main` mergeado y contenido en main, un deployment de producción READY para el main actual, HTTP 200 en el dominio de producción y la comprobación de social-auth en verde; vuelve a comprobar las identidades después del sondeo HTTP. HTTP 200 prueba disponibilidad, no recorridos de producto: el comportamiento cambiado se verifica aparte. Un deployment, auth o actualización de Zoho fallidos dejan el cierre pendiente; la tarea sólo se cierra tras verificar producción. Credenciales y respuestas crudas de Vercel nunca entran a Git.
- Commits: Conventional Commits, atómicos, sin trailers de atribución a IA. Nunca commitear `.env` ni secretos; `.env.example` es el único `.env` versionado y no lleva valores reales.
- Definition of Done: criterio de aceptación cumplido, `typecheck` limpio, `lint` en 0, tests verdes con test nuevo si se tocó lógica, y la decisión no trivial anotada en el ticket de Zoho.

## Map

- funciones de Convex y su alcance: `convex/lib/fn.ts`; `pnpm test -- --run convex/reach.test.ts`
- catálogo del MCP: `src/features/mcp/tools/catalog.ts`; `pnpm test -- --run src/features/mcp`
- ruta MCP y su token propio: `src/features/mcp/auth.ts`, `convex/lib/mcpToken.ts`; `pnpm test -- --run src/features/mcp`
- fechas y timezone: `src/shared/time`, `convex/lib/time.ts`; `pnpm test -- --run src/shared/time`
- recordatorios: `convex/lib/recordatorios.ts` (calendario), `convex/lib/avisos.ts` (puente), `convex/notifications.ts`, `convex/pushSend.ts` (cron); `pnpm test -- --run convex/lib/recordatorios`
- correo de recordatorios: `convex/lib/correo.ts`
- crons: `convex/crons.ts`, bitácora `cronRuns`; `pnpm test -- --run convex`
- webhook de Clerk y rutas HTTP: `convex/http.ts`; `pnpm test -- --run convex`
- middleware de Clerk y fila de `users`: `src/proxy.ts`
- migraciones: `convex/migrations/`
- revisión de documentos: `convex/reviews.ts`, `convex/lib/reviews.ts`, `src/features/reviews/`; `pnpm test -- --run src/features/reviews`
- fuentes conectadas: `convex/captures.ts`, `src/features/connections/providers.ts`; `pnpm test -- --run src/features/connections`
- sincronización con GitHub: `src/features/github-sync/` (`KINO_OWNED_FIELDS` en `github-sync.mapper.ts`); `pnpm test -- --run src/features/github-sync`
- manifiesto de arquetipos y mediums: `src/shared/lib/system-types.ts`, `src/shared/lib/mediums.ts`
- cliente de datos: `src/shared/convex/hooks.ts` (`useConvexQuery`, `useConvexMutation`)
- transporte de fechas por la red: `src/shared/lib/transport.ts`
- errores y analítica: `src/shared/observability/sentry-options.ts`, `src/shared/observability/analytics.ts`
- respaldo: `scripts/backup/`, `.github/workflows/backup.yml`
- importador de Postgres: `scripts/migrate-to-convex/` (`pnpm migrate:convex`, sólo para el cutover)
- delivery y producción: `scripts/delivery.py`; `python3 -m unittest discover -s scripts/tests -v`

## Taste

- **Una suscripción, no una caché.** Convex es reactivo: no hay query keys, no hay `refetch` (existe en el tipo y no hace nada), no hay TanStack Query. El argumento de la función es la clave, así que dos componentes que piden lo mismo comparten una lectura (`ConvexQueryCacheProvider`). Toda lectura de cliente pasa por `useConvexQuery` y de servidor por `serverQuery`: cero `fetch` suelto, cero `useEffect + setState` para datos de servidor.
- **Una pantalla con props de un server component no se entera de nada.** Si el valor puede cambiar con la pantalla abierta (título de una página, nombre de una carpeta), el componente se suscribe (`usePage`, `usePages`, `useFolders`) y usa la prop sólo como `initialData`, y la ruta pide con los mismos argumentos que el hook. `useConvexMutation` espera la respuesta salvo con `optimisticUpdate` (hoy sólo `useUpdateStickyNote`).
- **Vertical slice.** La lógica que dos slices necesitan va a `shared`, no se importa de un slice a otro (`shared/lib/word-count` es el caso); en servidor, a `convex/lib`. No hay `index.ts` por slice, a propósito. La lógica de negocio y el scoring de energía, urgencia e importancia viven en `convex/`: el cliente nunca recalcula.
- **Lo que cruza la red no es una fila.** `Transport<T>` convierte fechas en ISO; el cliente usa `TaskTransport`, y un Server Component que pase filas como `initialData` llama `toTransport` primero.
- **Validación.** Una sola fuente Zod por entidad, importada por servidor y cliente; el backend siempre valida. `userId` siempre viene de la sesión, nunca del body. Los `metadata` se validan con Zod discriminado por `systemType`.
- **Tools del MCP.** `Spec<F, S>` (`define.ts`) liga la tool a la función y a su schema de entrada: cambiar una función rompe el typecheck de la tool, no la primera llamada del agente. Lo escrito a mano es lo que el agente lee: nombre y descripción.
- **Estado.** Filtros de lista en la URL (`useSearchParams`), UI efímera en `useState`/`useReducer`, timer activo cross-route en un Context en root. Zustand sólo para estado de UI global (booleanos y preferencias; los cuatro stores que hay son `ThemeProvider`, `command-palette`, `quick-add`, `systems`), nunca datos de servidor. No Redux, no Jotai, no TanStack Query.
- **Animaciones.** CSS puro: no instalar Framer Motion. Sólo `transform`, `opacity` y color; nunca una propiedad de layout ni un desenfoque en bucle. `prefers-reduced-motion` lo apaga todo desde `globals.css`; una animación que corre en JavaScript pregunta por la preferencia ella misma (`EnergyTodayCard`). No añadir `transition-all`: cada transición declara sus propiedades.
- **UI.** Sin emojis: texto o iconos lucide. Móvil: sin drag and drop en touch, acciones hover con `md:opacity-0`; la rama por viewport va antes del contexto de arrastre, y el gesto perdido gana una operación con nombre que deja su evento y se deshace (`BoardMoveSheet`, `StackNoteSheet`).
- **Sin `any`**, sin saltarse Zod en ningún input de endpoint, sin timestamps sin timezone.
