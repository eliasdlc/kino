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
- **ORM**: Drizzle ORM (NOT Prisma) — chosen for native PostgreSQL extension support
- **Database**: PostgreSQL 15 (Railway) with `uuid-ossp` and `ltree` extensions
- **Auth**: Better Auth — stateful sessions in PostgreSQL, HttpOnly cookies, NO JWT
- **State**: TanStack Query v5 (server state) + Zustand (UI state)
- **Styling**: Tailwind CSS + shadcn/ui (Radix primitives)
- **Background jobs**: Lazy Evaluation (catch-up on login) + Vercel Cron Jobs
- **Payments**: Lemon Squeezy (NOT Stripe)
- **Email**: Resend
- **Storage**: Cloudflare R2 (S3-compatible)
- **Deploy**: Vercel (app) + Railway (PostgreSQL only)
- **Package manager**: pnpm (NOT npm, NOT yarn)
- **Parsing**: ical.js (iCalendar), rrule.js (recurrence)

## Project Layout

```
src/
├── features/           # Vertical Slices — each feature is self-contained
│   ├── auth/           # Login, register, OAuth, sessions
│   ├── onboarding/     # Profile selection, templates, initial config
│   ├── systems/        # CRUD systems, Inbox, System Health
│   ├── tasks/          # CRUD tasks, energy funnel, RRULE, subtasks
│   ├── pages/          # Markdown pages, ltree folder hierarchy
│   ├── sticky-notes/   # Visual short notes
│   ├── focus/          # Focus Mode, time_logs, analytics
│   ├── dashboard/      # Smart View, Energy Check-in, widgets
│   ├── sync-*/         # Sync adapters (Premium) — one slice per provider
│   ├── notifications/  # Web Push + weekly reports (Resend)
│   ├── billing/        # Lemon Squeezy webhooks, trial, subscription
│   └── scheduler/      # Lazy Evaluation catch-up + Vercel Cron triggers
├── shared/
│   ├── db/
│   │   └── schema.ts   # ALL Drizzle schema definitions — single source of truth
│   ├── middleware/      # Auth guards, rate limiting, error normalization
│   ├── utils/           # Pure utility functions (ltree helpers, time, etc.)
│   └── types/           # Shared TypeScript types and Zod schemas
└── app/                 # Next.js App Router pages and layouts
```

**Vertical Slice rule**: Each feature directory is self-contained with its own handler, business logic, queries, and DTOs. Slices communicate only through explicit shared interfaces. Never import directly from another slice's internals.

## Architecture Constraints — Do NOT Violate

1. **$0/month infra**: Everything must run within free tiers of Vercel + Railway + Cloudflare R2.
2. **No Redis, no BullMQ, no persistent server**: 100% Serverless. Background work = Lazy Evaluation + Vercel Cron.
3. **No WebSockets**: Vercel Serverless doesn't support persistent connections. Use TanStack Query polling (`refetchInterval` + `invalidateQueries`).
4. **Vercel Serverless 10s limit** (free tier): All operations must complete within 10 seconds. Paginate heavy operations (catch-up max 30 days/request, .ics parsing in batches).
5. **No JWT**: Better Auth uses stateful sessions in PostgreSQL with HttpOnly cookies.
6. **system_id is NOT NULL on tasks**: Every task belongs to a system. Inbox (is_inbox=true) is the default. No floating tasks.
7. **All timestamps in UTC** (TIMESTAMPTZ). Frontend converts to user's timezone for display.
8. **DATE columns** (due_date, system_health.date) represent logical dates in the user's timezone — deliberate exception documented in SADD.
9. **Soft delete** for tasks and pages (deleted_at column). Always filter with `WHERE deleted_at IS NULL`.

## Database & Drizzle Gotchas

- Schema lives in `src/shared/db/schema.ts` — single file, single source of truth.
- **ltree operations require raw SQL**: Drizzle doesn't support ltree operators natively. Use `sql` tagged template for `<@`, `@>`, `~`, `nlevel()`, `subpath()`.
  ```typescript
  // CORRECT — raw SQL escape hatch
  const subtree = await db.execute(
    sql`SELECT * FROM folders WHERE user_id = ${userId} AND path <@ ${parentPath}::ltree`
  );
  // WRONG — Drizzle query builder cannot express ltree operators
  ```
- **Partial unique indexes** need `sql` in Drizzle: `uniqueIndex('name').on(table.col).where(sql`...`)`.
- **CHECK constraints**: Drizzle doesn't generate CHECK constraints. Add them manually in migrations or via `drizzle-kit push` with custom SQL.
- **Enums**: Defined as `pgEnum()` in Drizzle. The `color` enum is used for systems, folders, context_tags, and sticky_notes — it is a PostgreSQL ENUM, NOT a hex string.
- **ON DELETE behavior** matters: CASCADE for owned entities, SET NULL for optional references. Verify FK behavior matches SADD before writing any migration.
- Run `drizzle-kit push` against an empty DB as a smoke test before writing business logic — catches malformed enums, circular FKs, and bad constraints early.

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

Every API route must:
1. Validate session via Better Auth middleware (get user_id from session, NEVER from request body)
2. Validate input with Zod
3. Use `user_id` from session for ALL queries (row-level isolation)
4. Return normalized error shape: `{ code, message, details? }`

### Optimistic UI (Frontend)
All mutations use TanStack Query optimistic updates:
1. `onMutate`: update cache with temporary ID
2. `onSuccess`: replace temp ID with server UUID
3. `onError`: rollback cache + show toast
4. NEVER block UI waiting for server response

### Error Handling
- Backend: typed domain errors mapped to HTTP status codes
- Frontend: rollback + toast on mutation failure
- Network errors: TanStack Query retry with exponential backoff (max 3)

## Security Checklist

- [ ] `user_id` always comes from the authenticated session, never from client input
- [ ] All Premium endpoints check subscription status via guard
- [ ] OAuth tokens are encrypted in DB, never exposed to client
- [ ] Rate limiting via Vercel Edge Middleware (runs before Serverless Functions)
- [ ] CSP headers + HttpOnly + Secure + SameSite=Lax on all cookies
- [ ] No raw SQL interpolation — always use Drizzle parameterized queries or `sql` template

## Git Workflow

- Branch naming: `feat/`, `fix/`, `refactor/`, `docs/` prefix
- Commits: [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`
- Before pushing: `pnpm typecheck && pnpm lint && pnpm build`
- Never commit `.env` files or secrets

## Testing Strategy

- Unit tests for business logic (service layer, pure functions)
- Integration tests for API routes (test full request → response cycle)
- Test files colocated with source: `{feature}.service.test.ts`
- Use test database (Docker Compose, port 5433) — never test against production

## What NOT To Do

- **Do NOT install Prisma** — Drizzle was chosen specifically for ltree + native PG extension support.
- **Do NOT add Redis or any queue system** — contradicts $0/month serverless architecture.
- **Do NOT use `localStorage` or `sessionStorage`** for auth — Better Auth handles this via HttpOnly cookies.
- **Do NOT create tasks with `system_id = null`** — always default to user's Inbox.
- **Do NOT store timestamps without timezone** — use TIMESTAMPTZ, always UTC.
- **Do NOT import from another feature's internals** — go through shared interfaces.
- **Do NOT use `any` type** — TypeScript strict mode, no exceptions.
- **Do NOT skip Zod validation** on any API endpoint input.
<!-- END:nextjs-agent-rules -->
