<!-- BEGIN:nextjs-agent-rules -->
# Kino — Productivity Platform

Strategic productivity platform built around cognitive energy management and identity-based systems. Monorepo, fullstack Next.js 16, 100% Serverless.

## Core Commands

```bash
pnpm install                        # Install dependencies
pnpm dev                            # Next.js dev server (http://localhost:3000)
pnpm build                          # Production build — run before any PR
pnpm lint                           # ESLint strict TypeScript — must pass, zero warnings
pnpm typecheck                      # tsc --noEmit — must pass
pnpm db:generate                    # drizzle-kit generate (migrations)
pnpm db:push                        # drizzle-kit push (apply schema to DB)
pnpm db:studio                      # Drizzle Studio (DB browser)
pnpm test                           # Run full test suite
pnpm test -- --run <path>           # Run single test file
```

**IMPORTANT**: Always run `pnpm typecheck && pnpm lint` after any code change. If either fails, fix before committing.

## Tech Stack (exact versions matter)

- **Framework**: Next.js 16 (App Router, API Routes, Server Actions)
- **Language**: TypeScript strict mode
- **ORM**: Drizzle ORM — chosen for native PostgreSQL extension support
- **Database**: PostgreSQL 15 (Neon) with `uuid-ossp` and `ltree` extensions
- **Auth**: Better Auth — stateful sessions in PostgreSQL, HttpOnly cookies, NO JWT
- **State**: TanStack Query v5 (server state)
- **Styling**: Tailwind CSS + shadcn/ui (Radix primitives)
- **Background jobs**: Lazy Evaluation (catch-up on login) + Vercel Cron Jobs
- **Email**: Resend
- **Deploy**: Vercel (app) + Neon (PostgreSQL only)
- **Package manager**: pnpm (NOT npm, NOT yarn)


```

**Vertical Slice rule**: Each feature directory is self-contained with its own handler, business logic, queries, and DTOs. Slices communicate only through explicit shared interfaces. Never import directly from another slice's internals.

## Architecture Constraints — Do NOT Violate

1. **$0/month infra**: Everything must run within free tiers of Vercel + Neon.
2. **No Redis, no BullMQ, no persistent server**: 100% Serverless. Background work = Lazy Evaluation + Vercel Cron.
3. **No WebSockets**: Vercel Serverless doesn't support persistent connections. Use TanStack Query polling (`refetchInterval` + `invalidateQueries`).
4. **Vercel Serverless 10s limit** (free tier): All operations must complete within 10 seconds. Paginate heavy operations (catch-up max 30 days/request, .ics parsing in batches).
5. **No JWT**: Better Auth uses stateful sessions in PostgreSQL with HttpOnly cookies.
6. **system_id is NOT NULL on tasks**: Every task belongs to a system. Inbox (is_inbox=true) is the default. No floating tasks.
7. **All timestamps in UTC** (TIMESTAMPTZ). Frontend converts to user's timezone for display.
8. **DATE columns** (due_date, system_health.date) represent logical dates in the user's timezone — deliberate exception documented in SADD.
9. **Soft delete** for tasks and pages (deleted_at column). Always filter with `WHERE deleted_at IS NULL`.


## Coding Patterns

### API Routes (Backend)
```
src/features/{feature}/
├── {feature}.routes.ts      # API route handlers (Next.js API Routes)
├── {feature}.service.ts     # Business logic (pure functions when possible)
├── {feature}.queries.ts     # Drizzle queries
├── {feature}.schemas.ts     # Zod validation schemas + DTOs
└── {feature}.types.ts       # TypeScript types specific to this feature
```


## Git Workflow

- Commits: [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`
- Before pushing: `pnpm typecheck && pnpm lint && pnpm build`
- Never commit `.env` files or secrets


## What NOT To Do

- **Do NOT store timestamps without timezone** — use TIMESTAMPTZ, always UTC.
- **Do NOT import from another feature's internals** — go through shared interfaces.
- **Do NOT use `any` type** — TypeScript strict mode, no exceptions.
- **Do NOT skip Zod validation** on any API endpoint input.
- **Do NOT introduce Zustand/Redux/Jotai** — TanStack Query + React Context es suficiente (ver DECISIONS.md §0.5).
- **Do NOT implement Premium/subscription guards** — billing está en roadmap, no existe código de payments.

## Roadmap / No implementado

Las siguientes features están en el schema o documentadas pero **no tienen implementación activa**.
No referenciarlas como si existieran en el código. Ver `docs/STATUS.md` para el estado real de cada feature.

- **Billing / Premium / Lemon Squeezy**: sin código. `subscriptionStatus`, `planType` en schema son placeholders.
- **Sync adapters** (`sync-*`): `syncConnections` table en schema, sin lógica de sincronización.
- **`focus/` route**: no existe. Focus timer vive como widget inline, no como ruta dedicada.
- **Quests / Inventory / Gamificación**: tablas en schema, sin UI ni lógica.
- **Recurrencia (RRULE)**: `rrule.js` en roadmap. Columnas en schema, sin state-machine ni UI.
- **iCalendar import** (`ical.js`): sin implementación.
- **Cloudflare R2 / Storage**: sin uso activo.
- **Integración Asana / Linear / Google Classroom**: roadmap.
- **Context tags UI**: tabla en schema, sin pantalla de gestión.
- **Habit streaks**: depende de recurrencia.
- **Landing page y docs públicas**: roadmap.
<!-- END:nextjs-agent-rules -->
