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
pnpm db:migrate                     # Aplicar migraciones
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
3. **Sin WebSockets.** Vercel Serverless no soporta conexiones persistentes; usar polling de TanStack Query (`refetchInterval` + `invalidateQueries`).
4. **Límite de 10s** por función en free tier. Paginar lo pesado.
5. **Sin JWT.** Better Auth con sesiones en Postgres.
6. **`system_id` es NOT NULL en tasks.** Toda tarea pertenece a un sistema; Inbox es el default. No hay tareas flotantes.
7. **Timestamps en UTC** (TIMESTAMPTZ). El frontend convierte para mostrar.
8. **Soft delete** en tasks y pages vía `deleted_at`. Siempre filtrar con `WHERE deleted_at IS NULL`.

**Dato de operación crítico:** development y production **comparten la misma base Neon**. No hay branch de datos: `pnpm db:migrate` desde local escribe en producción. Toda migración debe ser compatible hacia atrás con el código ya desplegado.

## Estructura — vertical slice

```
src/features/{feature}/
├── {feature}.routes.ts      # Handlers de API Routes
├── {feature}.service.ts     # Lógica de negocio (funciones puras donde se pueda)
├── {feature}.queries.ts     # Queries Drizzle
├── {feature}.schemas.ts     # Schemas Zod + DTOs
└── {feature}.types.ts       # Tipos propios del slice
```

Cada feature es autocontenida. Los slices se comunican **solo** por interfaces compartidas explícitas. Nunca importar los internals de otro slice.

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

### Estado

| Tipo | Herramienta |
|---|---|
| Server state | TanStack Query |
| Filtros de lista | URL (`useSearchParams`) |
| UI efímera | `useState` / `useReducer` |
| Timer activo cross-route | React Context en root |

**No introducir Zustand, Redux ni Jotai.** TanStack Query + Context alcanza.

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
- Nunca commitear `.env` ni secretos.

## Definition of Done

Criterio de aceptación cumplido · `typecheck` limpio · `lint` en 0 · tests verdes con test nuevo si se tocó lógica · commit atómico · decisión no trivial anotada en el issue de Linear.

## Qué NO hacer

- **No** guardar timestamps sin timezone.
- **No** importar internals de otro slice.
- **No** usar `any`.
- **No** saltarse Zod en ningún input de endpoint.
- **No** introducir Zustand/Redux/Jotai.
- **No** implementar guards de Premium/subscripción — no existe código de payments.
- **No** reimplementar cálculos de fecha fuera de `src/shared/time`.
- **No** crear archivos Markdown en el repo más allá de `README.md`, `AGENTS.md` y `DESIGN.md`.

## Features en el schema sin implementación activa

No referenciarlas como si existieran:

- **Billing / Premium**: `subscriptionStatus` y `planType` son placeholders, sin código.
- **Sync adapters**: la tabla `syncConnections` existe, sin lógica.
- **GitHub sync**: `externalSource`, `externalId` y `sprints.externalId` están sembrados a propósito, dormidos.
- **iCalendar import**: sin implementación.
- **Context tags**: tabla en schema, sin pantalla de gestión.
- **Captura offline**: existe `/offline` y un service worker que **solo** hace push. No hay cola de mutaciones.
