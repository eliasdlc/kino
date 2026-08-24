# Kino — Plataforma de productividad por energía

Plataforma de productividad construida alrededor de la gestión de energía cognitiva y sistemas basados en identidad. Fullstack Next.js 16, 100% serverless.

> **Los planes, el estado y el orden de trabajo viven en Linear**, no en este repo. Este archivo cubre comandos, stack y convenciones de código — nada de roadmap.
>
> En Linear: los proyectos van numerados `01`–`07` en orden de ejecución. Los documentos del equipo *Norte, principios y estándares*, *Estado real del producto* e *Índice de decisiones D1–D16* son la fuente de verdad de qué se construye y por qué.
>
> **En este repo solo se aceptan tres Markdown:** `README.md`, `AGENTS.md` y `DESIGN.md`. Ningún plan, audit ni análisis. Las notas locales que no son código van a `~/Documents/Kino/dev/`.

## Comandos

```bash
pnpm install                        # Instalar dependencias
pnpm dev                            # Dev server (http://localhost:3000)
pnpm build                          # Build de producción
pnpm lint                           # ESLint strict — debe pasar con 0 errores
pnpm typecheck                      # tsc --noEmit — debe pasar
pnpm db:generate                    # drizzle-kit generate (migraciones)
pnpm db:migrate                     # Aplicar migraciones a la base de DATABASE_URL (local: rama de desarrollo)
pnpm db:studio                      # Drizzle Studio
pnpm test                           # Suite completa
pnpm test -- --run <path>           # Un solo archivo de test
```

**Siempre** correr `pnpm typecheck && pnpm lint` después de cualquier cambio. Si alguno falla, se arregla antes de commitear.

## Stack

- **Framework**: Next.js 16 (App Router, API Routes, Server Actions)
- **Lenguaje**: TypeScript strict
- **ORM**: Drizzle
- **Base de datos**: PostgreSQL (Neon) con `uuid-ossp` y `ltree`
- **Auth**: Better Auth — sesiones stateful en Postgres, cookies HttpOnly, **sin JWT**
- **Email transaccional**: Resend por API REST (`src/shared/email`, sin SDK). `RESEND_API_KEY` + `EMAIL_FROM`; sin la key, el correo se omite sin romper el flujo: en dev se imprime en consola y en producción queda un aviso en el log
- **Server state**: TanStack Query v5
- **Formularios**: react-hook-form + zodResolver
- **Estilos**: Tailwind + shadcn/ui (Radix)
- **Toasts**: sonner · **Gráficas**: Recharts · **Fechas**: date-fns · **Recurrencia**: rrule
- **Editor**: Tiptap v3
- **Background**: Lazy Evaluation (catch-up al entrar) + Vercel Cron + cron externo
- **Deploy**: Vercel + Neon
- **Package manager**: pnpm (NO npm, NO yarn)

## Restricciones de arquitectura — no violar

1. **$0/mes de infraestructura.** Todo dentro de free tiers de Vercel + Neon.
2. **Sin Redis, sin BullMQ, sin servidor persistente.** 100% serverless.
3. **Sin WebSockets.** Vercel Serverless no soporta conexiones persistentes. Lo que refresca hoy es `refetchOnWindowFocus`, el default de TanStack Query: con un solo usuario, volver a la pestaña llega a tiempo. `refetchInterval` no se usa en ningún sitio y no es la alternativa prescrita: cada intervalo activo es una invocación por usuario y por minuto contra el free tier. La señal que reabriría la decisión es el agente MCP escribiendo mientras miras el tablero.
4. **10s por función, salvo excepción justificada.** Es el presupuesto por defecto y las rutas que lo declaran usan `export const maxDuration = 10`. La única excepción viva es `/api/mcp`, en 60s, porque el protocolo mantiene la petición abierta mientras el agente encadena herramientas. Subir el límite en una ruta nueva es una decisión, no un ajuste: escríbela en el comentario de la ruta. Paginar lo pesado sigue siendo la respuesta primero.
5. **Sin JWT.** Better Auth con sesiones en Postgres.
6. **`system_id` es NOT NULL en tasks.** Toda tarea pertenece a un sistema; Inbox es el default. No hay tareas flotantes.
7. **Timestamps en UTC** (TIMESTAMPTZ). El frontend convierte para mostrar.
8. **Soft delete** en tasks y pages vía `deleted_at`. Siempre filtrar con `WHERE deleted_at IS NULL`.

## Entornos y base de datos

Producción y desarrollo son **dos ramas de Neon** con cadenas de conexión distintas. Ninguna laptop tiene la de producción.

| Entorno | Quién la usa | `DATABASE_URL` |
|---|---|---|
| Producción | el deploy de `main` en Vercel | variable **Production** de Vercel, y en ningún otro sitio |
| Desarrollo | los previews de Vercel (PRs y `dev`) y el `.env.local` de cada máquina | rama de desarrollo de Neon: variable **Preview** de Vercel y `.env.local` |
| Local aislado | `docker compose up -d` y la batería de aislamiento (`pnpm test:isolation`, que hace `TRUNCATE`) | `postgresql://kino:kino_dev_password@localhost:5433/kino` |

**Las migraciones a producción las aplica sólo el despliegue.** El `buildCommand` de `vercel.json` corre `pnpm db:migrate` antes de `next build` con la variable del entorno que está construyendo: un preview migra la rama de desarrollo y el deploy de `main` migra producción. Si la migración falla, el build falla y el deploy anterior sigue arriba; el código nunca sale sin su schema. `pnpm db:migrate` desde local sólo llega a la base de `.env.local`.

Toda migración sigue teniendo que ser **compatible hacia atrás** con el código ya desplegado: el build migra antes de publicar, y entre una cosa y la otra el código viejo lee el schema nuevo.

Las variables de entorno están documentadas en **`.env.example`**, una línea por clave con para qué sirve y si es obligatoria. Toda variable nueva se añade ahí en el mismo commit que la lee.

## Estructura — vertical slice

```
src/features/{feature}/
├── {feature}.routes.ts      # Handlers de API Routes
├── {feature}.service.ts     # Lógica de negocio (funciones puras donde se pueda)
├── {feature}.queries.ts     # Queries Drizzle
├── {feature}.schemas.ts     # Schemas Zod + DTOs
└── {feature}.types.ts       # Tipos propios del slice
```

Cada feature es autocontenida en lo que puede. Tipos, hooks y componentes cruzan entre slices cuando hace falta: `systems` renderiza las tarjetas de `tasks` porque un sistema enseña tareas, y eso no es acoplamiento accidental.

Lo que sí es una decisión: **un `.service.ts` no importa el `.service.ts` de otro slice salvo que orquestar sea su trabajo.** `insights` y `scheduler` orquestan y por eso importan tres servicios cada uno; el resto no debería. Si un servicio necesita lógica de otro y no está orquestando, esa lógica va a `shared` (como `shared/lib/word-count`, que usaban `pages` y `writing` a la vez y creaba un ciclo entre los dos slices).

No hay `index.ts` por slice ni regla de lint que lo verifique, y es a propósito: con dieciséis slices y un desarrollador, declarar una superficie pública por slice cuesta más de lo que evita.

## Convenciones de código

### Data fetching

Toda lectura de servidor pasa por TanStack Query. Cero `fetch` suelto en componentes, cero `useEffect + setState` para datos de servidor.

Los query keys se declaran como **factory por feature** (`taskKeys`, `pageKeys`, …), nunca como strings inline. No hay factory central: cada slice expone el suyo.

### Mutaciones — patrón optimista canónico

**Todas** las mutaciones lo usan, sin excepción: UI optimista siempre, rollback en error, invalidate en settled.

```ts
onMutate:  cancelQueries → snapshot del cache → setQueryData optimista → return { prev }
onError:   setQueryData(prev)  // rollback
onSettled: invalidateQueries
```

La referencia canónica vive en `src/features/tasks/tasks.hooks.ts` (Rumbo 05). Si lo tocas, no rompas esa referencia.

### Fechas y timezone

**El gotcha número uno del proyecto.** Todo gira alrededor de "hoy", `dueDate`, slots y "vencidas".

- Todo pasa por **`src/shared/time`** (`userToday`, `userDayRange`, `sqlUserDay`, `dayToLocalISO`, `zonedDayHourToUtc`). **Está prohibido reimplementar "hoy en la timezone del usuario"** en cualquier otro lado.
- `dueDate` y `startDate` son **`timestamptz` con hora opcional**, no columnas DATE. Cuidado con el off-by-one.
- El cálculo de "hoy" y de slots para lógica de negocio se hace **en el servidor** con la timezone del usuario. El cliente solo pinta — así un reloj mal puesto en el cliente no corrompe el plan.

### Validación

Una sola fuente Zod por entidad, importada por servidor y cliente. El backend **siempre** valida aunque el cliente ya lo hizo. `userId` **siempre** viene de la sesión, nunca del body. Los `metadata` jsonb se validan con Zod discriminado por `systemType` — metadata no es un saco.

Las rutas que tocan credenciales o borran la cuenta (`/api/account/*`) llevan `sessionOnly: true` en `route()`: sólo la sesión del navegador, nunca una clave API ni un token OAuth del MCP, aunque sean del mismo usuario.

### Estado

| Tipo | Herramienta |
|---|---|
| Server state | TanStack Query |
| Filtros de lista | URL (`useSearchParams`) |
| UI efímera | `useState` / `useReducer` |
| Timer activo cross-route | React Context en root |
| UI global (abierto/cerrado, tema, sidebar) | Zustand |

**Zustand sólo para estado de UI global.** Nunca datos de servidor: eso es de TanStack Query y no se copia a un store paralelo. La regla existía para impedir esa fuga, y esa fuga no se ha dado: los cuatro stores que hay (`ThemeProvider`, `command-palette`, `quick-add`, `systems`) guardan booleanos y preferencias. Para un booleano de apertura, un provider más en el árbol re-renderiza todo lo que cuelga de él a cambio de nada.

**No introducir Redux ni Jotai.** Con TanStack Query, Zustand y el Context que ya existe para el timer, sobra.

### Lógica de negocio

Todo scoring de energía, urgencia e importancia vive en el **backend** (`*.service.ts`). El cliente nunca recalcula: recibe el valor ya computado.

### Animaciones

CSS puro — keyframes, transitions, Tailwind. **No instalar Framer Motion.** Animar solo `transform` y `opacity` (GPU), nunca `top`/`left`. Respetar `prefers-reduced-motion`.

### UI

- **Sin emojis.** Texto o iconos lucide.
- **Mobile**: `ResponsiveDialog` (Dialog en desktop, Drawer en móvil), vistas `*MobileView`, **sin drag and drop en touch**, acciones hover con `md:opacity-0`.
- Todo cambio de UI se previsualiza en **`/system-design`** y añade su specimen.
- Cada ruta con su `loading.tsx`, cubierta por un `error.tsx`.

### El manifiesto de arquetipo

`src/shared/lib/system-types.ts` es la fuente única de cómo se comporta cada `systemType`: vocabulario, `folderRole`, `pageRole`, `taskKinds`. **Nunca hardcodear un label o un comportamiento por tipo de sistema** — se lee del manifiesto. Añadir un arquetipo debe ser añadir una entrada, no un fork de código.

Lo mismo para los mediums de escritura en `src/shared/lib/mediums.ts`. Ojo: el manifiesto gobierna lo que el editor **ofrece** (slash menu, plantilla, export), no lo que el schema admite — los nodos se montan siempre para que cambiar de medium nunca degrade contenido ya escrito.

## Git

- **Ramas**: `main` → `dev` → rama de feature. Nunca push directo a `main`.
- **Commits**: Conventional Commits, atómicos, **sin trailers de atribución a IA**.
- Las ramas completadas son registro histórico: **no se borran**.
- Antes de un PR: `pnpm typecheck && pnpm lint && pnpm test`.
- Nunca commitear `.env` ni secretos. `.env.example` es el único `.env` versionado y no lleva valores reales.

## Definition of Done

Criterio de aceptación cumplido · `typecheck` limpio · `lint` en 0 · tests verdes con test nuevo si se tocó lógica · commit atómico · decisión no trivial anotada en el issue de Linear.

## Qué NO hacer

- **No** guardar timestamps sin timezone.
- **No** importar el `.service.ts` de otro slice sin estar orquestando.
- **No** usar `any`.
- **No** saltarse Zod en ningún input de endpoint.
- **No** introducir Redux ni Jotai, ni meter datos de servidor en un store de Zustand.
- **No** implementar guards de Premium/subscripción — no existe código de payments.
- **No** reimplementar cálculos de fecha fuera de `src/shared/time`.
- **No** crear archivos Markdown en el repo más allá de `README.md`, `AGENTS.md` y `DESIGN.md`.

## Features en el schema sin implementación activa

No referenciarlas como si existieran:

- **Billing / Premium**: `subscriptionStatus` y `planType` son placeholders, sin código.
- **Sync adapters**: `syncConnections` sólo la usa GitHub (ver abajo). El resto de valores de `syncProviderEnum` siguen sin lógica.
- **iCalendar import**: sin implementación.
- **Context tags**: tabla en schema, sin pantalla de gestión.
- **Captura offline**: existe `/offline` y un service worker que **solo** hace push. No hay cola de mutaciones.

## Sincronización con GitHub (KIN-135)

Un sistema `project` puede declarar un repositorio en `systems.metadata.github` y traer sus issues al board como tarjetas. El slice es `src/features/github-sync/`.

- **Dirección: sólo lectura.** GitHub manda sobre título, cuerpo, abierto/cerrado y milestone. Kino nunca escribe en GitHub.
- **Idempotencia** por `uq_tasks_external` `(user_id, external_source, external_id)`, con `external_id` = id numérico global del issue. Los milestones mapean a sprints por `uq_sprints_external` `(system_id, external_id)`.
- **Lo que un refresco nunca pisa**: `energyLevel`, `dueDate`, `startDate`, `inTodayPlan` y demás campos de `KINO_OWNED_FIELDS` (`github-sync.mapper.ts`). Son el valor que Kino añade sobre un issue; si un refresco los borrara, el feature destruiría trabajo.
- **Columnas**: issue cerrado → columna terminal (que completa la tarea por el puente de `moveTaskBoard`); reabierto → sale de la terminal. Las columnas intermedias las mueve la persona y la sincronización no las toca.
- **Refresco**: bajo demanda al abrir el board o con el botón. Sin cron — la única entrada de `vercel.json` del free tier está ocupada.

Necesita `GITHUB_SYNC_CLIENT_ID`, `GITHUB_SYNC_CLIENT_SECRET` y `ENCRYPTION_KEY` (ver `.env.example`). Son un OAuth App aparte del login porque GitHub sólo admite **una** URL de callback por app y esa ya la ocupa Better Auth, y porque leer issues privados exige el scope `repo`. Sin estas variables la integración se oculta sola: no rompe nada, simplemente no aparece.
