# PLAN-00 — Baseline y Mapa de Dependencias

> Documento raíz. Léelo antes de ejecutar cualquier PLAN-01..06.
> Versión: 2026-06-01

---

## 1. Diagnóstico raíz

Kino tiene **dos interfaces** que no están sincronizadas:

- **UI web** — lo que el usuario ve y usa.
- **MCP server** (`packages/mcp/`) — lo que usa el agente IA.

Casi toda la "inteligencia" diferencial de Kino (energy analytics, sugerencia de sistema, patrones de recurrencia, descomposición de tareas) **ya existe en el backend y en el MCP**, pero no está conectada a la UI. El feedback recibido es esencialmente: "veo carpetas bonitas, no veo energía".

Los 6 planes corrigen esa brecha capa a capa.

---

## 2. DAG de dependencias

```
PLAN-06-capa1 (recurrencia funcional)
    └── PLAN-06-capa2 (inteligencia de patrones)

PLAN-04 (focus timer) ──────┐
                             ├──► PLAN-02 (analytics híbrido)
schema.ts learned_curve ────┘    (time_logs enriquecen analytics)

PLAN-01 (sistemas activos)  ──► añade recommendSystemNow; PLAN-04 puede reutilizarlo (no bloqueante)
PLAN-04 usa getSuggestedTasks, que YA existe (no lo aporta PLAN-01)
PLAN-05 (sticky notes) ─────►  autónomo (más fácil)
PLAN-03 (sync) ─────────────►  autónomo, decisión de diseño aparte
```

**Orden recomendado de ejecución:**
`PLAN-02` → `PLAN-05` → `PLAN-01` → `PLAN-04` → `PLAN-06` → `PLAN-03`

Justificación:
- **02** primero: cosecha lo que ya existe en backend (una card UI conecta todo). Impacto/esfuerzo óptimo.
- **05** segundo: autónomo, pequeño, aclara confusión de producto real.
- **01**: depende de que el energy check-in esté estable (ya lo está), no de los otros planes.
- **04**: el timer ya existe (commiteado). Lo que falta es la capa de sugerencia, que reutiliza `getSuggestedTasks` — función que YA existe en `insights.service.ts:127` (no la introduce PLAN-01). Por eso 04 no depende técnicamente de 01; el orden es solo para reutilizar `recommendSystemNow` si ya está hecho.
- **06**: motor de recurrencia desde cero. Largo. Bloqueante para la inteligencia de patrones.
- **03**: independiente pero el más complejo. Requiere diseño de sincronización separado.

---

## 3. Código compartido entre planes (no duplicar)

| Función/módulo | Planes que lo usan | Dónde vive |
|---|---|---|
| `getSuggestedTasks(userId, energyLevel?)` | PLAN-01, PLAN-04 | `src/features/insights/insights.service.ts:127` |
| `getEnergyDistribution(userId, days)` | PLAN-02 | `src/features/insights/insights.service.ts:100` |
| `getSystemColor(color)` | Todos los de UI | `src/shared/utils/system-colors.ts:18` — ya simplificado |
| `useTimerStore` | PLAN-04 | `src/features/tasks/timer.store.ts:22` |
| `queryEnergyBySystem` | PLAN-02 | `src/features/insights/insights.queries.ts:18` |
| `buildEnergyPlan` | PLAN-04 | `src/features/energy/energy.planner.ts:69` |

**Regla:** si un plan necesita crear un helper que ya existe en el servicio de otra slice, importa desde `shared/` o expone vía la interfaz pública del slice. No copia código.

---

## 4. Convenciones compartidas en todos los planes

### Branches
```
feat/plan-02-energy-analytics
feat/plan-05-sticky-capture
feat/plan-01-active-systems
feat/plan-04-focus-suggest
feat/plan-06-recurrence
feat/plan-03-sync-import
```

### Commits (Conventional Commits, sin Co-Authored-By)
- `feat(scope):` — nueva funcionalidad
- `fix(scope):` — corrección de bug
- `refactor(scope):` — sin cambio de comportamiento
- `chore(scope):` — configuración, deps
- `test(scope):` — tests únicamente
- `docs(scope):` — documentación

Scope = feature slug: `energy`, `systems`, `tasks`, `focus`, `insights`, `scheduler`

### Pre-flight (antes de empezar cada plan)
```bash
git status          # tree limpio
pnpm typecheck      # 0 errores
pnpm lint           # 0 warnings
```

### Post-flight (tras cada commit)
```bash
pnpm typecheck && pnpm lint
```

### Post-flight final de cada plan
```bash
pnpm typecheck && pnpm lint && pnpm build && pnpm test
```

### Seguridad — checklist mínimo por endpoint nuevo
- [ ] `userId` de sesión (never de request body)
- [ ] Validación Zod en todos los inputs
- [ ] Queries filtran por `userId`
- [ ] `WHERE deleted_at IS NULL` en tasks y pages
- [ ] Respuesta de error: `{ code, message, details? }`
- [ ] Endpoints premium con subscription guard si aplica

---

## 5. Gotchas globales (aplican a todos los planes)

- **`color` enum** — siempre `colorEnum('color')` en schema. Nunca string hex.
- **ltree** — usar `sql` template, no query builder de Drizzle.
- **Partial unique indexes** — requieren `sql` en Drizzle: `.where(sql`...`)`.
- **CHECK constraints** — Drizzle no los genera; añadir manual en migración.
- **TanStack Query keys** — arrays deterministas con todos los filtros.
- **Vercel 10s limit** — operaciones en batch, max 30 días por request, nunca expandir serie RRULE completa.
- **Timestamps** — siempre TIMESTAMPTZ UTC. `DATE` solo para fechas lógicas.
- **Inbox indestructible** — `DELETE` en sistema con `is_inbox=true` → 403.
- **Soft delete** — siempre `WHERE deleted_at IS NULL` en tasks y pages.

---

## 6. Estado del MCP (parity rule)

Cuando un plan expone algo en UI que ya existe como herramienta MCP, ambos deben consumir el **mismo service function**. No duplicar lógica.

| Tool MCP | Service que consume | Plan |
|---|---|---|
| `get_energy_distribution` | `getEnergyDistribution` | PLAN-02 |
| `detect_patterns` | `getTopPattern` | PLAN-01 |
| `suggest_next_action` | `getSuggestedTasks` | PLAN-01, PLAN-04 |
| `find_stale_systems` | `getStaleSystems` | PLAN-01 |
| `generate_subtasks` | **excepción**: LLM en `decompose.ts:121` (Anthropic), no comparte service con la UI (la UI usa heurística determinista, $0/mes) | PLAN-06 capa 2 |
| `classify_task` | `classifyTask` | PLAN-05 |

---

## 7. Estado actual del working tree

WIP consolidado en 4 commits sobre `main` (2026-06-01):

```
68f71636  feat(energy): calibración de curva aprendida desde historial real
caa2eb5d  feat(focus): agregar focus timer persistente con persistencia en time_logs
a4e925bb  refactor(ui): simplificar getSystemColor para devolver token Tailwind plano
038b4cfa  chore(workspace): allow builds for native deps en pnpm
```

Working tree: **limpio**. Las columnas `learned_curve` y `learning_alpha` en `userEnergyProfile` ya existen en `schema.ts:797-798` y tienen migración generada (`drizzle/0005_nebulous_frog_thor.sql`); el dashboard ya las consume (`LearningInsightCard`). Antes de ejecutar PLAN-04, asegurarse de que la migración 0005 está aplicada en la DB de desarrollo (`pnpm db:push` o el flujo de migraciones). No es una migración pendiente de crear.

---

## 8. Resumen de esfuerzo por plan

| Plan | Descripción | Esfuerzo estimado | Desbloquea |
|---|---|---|---|
| PLAN-02 | Energy analytics card | Bajo (backend listo) | — |
| PLAN-05 | Sticky notes → captura | Bajo | — |
| PLAN-01 | Sistemas activos + recomendador | Medio | PLAN-04 (helper compartido) |
| PLAN-04 | Focus con sugerencia de tarea | Medio | — |
| PLAN-06 | Motor de recurrencia + inteligencia | Alto | — |
| PLAN-03 | Sync import unidireccional | Muy alto | Decisión de diseño |
