# PLAN-01 — Sistemas Activos: de campos pasivos a recomendador real

> Prioridad: 3
> Rama: `feat/plan-01-active-systems`
> Depende de: ninguno (PLAN-04 reutiliza `getSuggestedTasks` definido aquí)
> Desbloquea: PLAN-04 (helper compartido `recommendSystemNow`)

---

## 1. Contexto y diagnóstico

### Lo que existe hoy (y no se usa)

Los sistemas tienen 4 campos con datos semánticos ricos que hoy son solo texto/badges pasivos:

| Campo | Schema | Usado en lógica | Mostrado en UI |
|---|---|---|---|
| `identityStatement` | `varchar(500)` | Solo en `classifyTask` (MCP) | Badge de texto en `SystemDetailHeader` |
| `energyIdeal` | `energyLevelEnum` | No | Badge en `SystemDetailHeader` |
| `triggerContext` | `varchar(255)` | No | Texto en `SystemDetailHeader` |
| `expectedFrequency` | `varchar(20)` | No | Badge en `SystemDetailHeader` |

El feedback "¿cuál sistema deberías tocar ahora?" no tiene respuesta en UI. Existe:
- `getStaleSystems` → `queryInactiveSystems` — detecta sistemas abandonados. Solo en MCP.
- `getSuggestedTasks(userId, energyLevel?)` — sugiere tareas. Solo en MCP.
- El check-in diario da `currentLevel` (energía ahora). No se cruza con `energyIdeal`.

### El gap específico

No existe `recommendSystemNow(userId)`: una función que cruce la energía actual del usuario con el `energyIdeal` de sus sistemas y el estado de actividad, y devuelva "trabaja en X ahora porque tu energía está alta y X lleva 5 días sin atención".

---

## 2. Objetivo y criterios de aceptación

- [ ] Nueva función `recommendSystemNow(userId)` en `insights.service.ts`.
- [ ] Dashboard muestra "Sistema recomendado ahora" (card o inline en columna derecha) cuando hay check-in del día.
- [ ] La recomendación incluye: nombre del sistema, razón en texto ("Tu energía está alta · este sistema lleva 3 días sin actividad").
- [ ] Página de detalle del sistema muestra stats reales: tareas completadas últimos 7d, tiempo invertido (si hay `time_logs`), última actividad.
- [ ] Los badges de `energyIdeal`, `expectedFrequency`, `triggerContext` en `SystemDetailHeader` tienen tooltip explicando qué significan (no seguir siendo datos mudos).
- [ ] MCP `find_stale_systems` y `suggest_next_action` consumen las mismas funciones que la UI.
- [ ] `pnpm typecheck && pnpm lint && pnpm build && pnpm test` pasan.

---

## 3. Decisiones de diseño

### Algoritmo de `recommendSystemNow`

Inputs disponibles:
- `energyCheckins.currentLevel` (0–100) de hoy — si no hay check-in, no hay recomendación.
- `systems.energyIdeal` por sistema.
- `queryInactiveSystems(userId, thresholdDays=3)` — sistemas sin actividad reciente.
- Conteo de tareas pendientes por sistema (`status IN ('today','week','tomorrow')`).

Lógica:
```
1. Si no hay check-in hoy → return null (sin recomendación)
2. Calcular "categoría energética actual":
   - currentLevel >= 70 → "high"
   - currentLevel >= 40 → "medium"
   - else → "low"
3. Filtrar sistemas activos (is_active=true, is_inbox=false)
4. Puntuar cada sistema:
   score = 0
   + 3 si energyIdeal == categoría actual
   + 2 si energyIdeal es null (neutral)
   + 1 si energyIdeal es adyacente (high↔medium, medium↔low)
   + 0 si energyIdeal es opuesto
   + 2 si está en queryInactiveSystems (lleva días sin atención)
   + 1 si tiene tareas pendientes en estado 'today'
5. Devolver sistema con mayor score + razón textual
```

La "razón textual" se construye de los factores que suman puntos. Ejemplos:
- "Tu energía está alta · tu sistema de mayor demanda te está esperando"
- "Este sistema lleva 4 días sin actividad · momento de retomarlo"

### Stats del sistema (para `SystemDetailHeader`)

Nueva query `getSystemStats(userId, systemId, days=7)`:
```typescript
{
  tasksCompleted: number,    // tasks WHERE completedAt IN last N days
  minutesSpent: number,      // SUM(time_logs.durationMinutes) IN last N days
  lastActivityAt: Date | null,
  pendingTasks: number
}
```

Esto se renderiza en `SystemDetailHeader` debajo de los badges existentes.

---

## 4. Cambios por capa

### 4.1 Queries — `src/features/insights/insights.queries.ts`

Nueva función `getSystemPendingCounts(userId)`:
```typescript
// SELECT system_id, COUNT(*) as pending
// FROM tasks WHERE status IN ('today','week','tomorrow') AND deleted_at IS NULL AND user_id = userId
// GROUP BY system_id
// Retorna: Map<systemId, pendingCount>
```

### 4.2 Queries — `src/features/systems/systems.queries.ts` (nuevo o en systems.service.ts)

Nueva función `getSystemStats(userId, systemId, days)`:
```typescript
// Dos queries en paralelo:
// 1. tasks: completedAt IN last N days, COUNT + last completedAt
// 2. time_logs: SUM(durationMinutes) IN last N days
// 3. tasks: COUNT WHERE status IN pending
```

### 4.3 Service — `src/features/insights/insights.service.ts`

Nueva función exportada `recommendSystemNow(userId)`:
```typescript
interface SystemRecommendation {
  systemId: string;
  systemName: string;
  systemColor: string;
  systemIcon: string;
  energyIdeal: string | null;
  reasons: string[];  // ["Tu energía está alta", "Sin actividad hace 3 días"]
  score: number;
}

export async function recommendSystemNow(userId: string): Promise<SystemRecommendation | null>
```

Esta función es pura en lógica de scoring (testeable unitariamente separando el scoring del DB fetch).

### 4.4 Route — `src/features/insights/insights.routes.ts`

Nueva función `getRecommendSystemRoute`:
```typescript
// GET /api/insights/recommend-system
// Sin params. userId de sesión.
// Responde: SystemRecommendation | { recommendation: null }
```

### 4.5 API Route — `src/app/api/insights/recommend-system/route.ts` (nuevo)

```typescript
export const GET = getRecommendSystemRoute;
```

### 4.6 Hook — `src/features/insights/insights.hooks.ts` (ampliar)

Nueva función `useRecommendedSystem()`:
```typescript
// useQuery → GET /api/insights/recommend-system
// key: ['recommend-system']
// staleTime: 5 * 60 * 1000
// Retorna: SystemRecommendation | null
```

### 4.7 UI — nuevo `src/features/dashboard/RecommendedSystemCard.tsx`

Client Component. Se muestra solo cuando hay check-in del día y hay recomendación.

```
┌──────────────────────────────────────────┐
│ 🎯 Trabaja en esto ahora                 │
│                                          │
│ 🔵 Proyectos personales                  │
│                                          │
│ Tu energía está alta · Sin actividad     │
│ hace 3 días                              │
│                                          │
│         [Ver sistema →]                  │
└──────────────────────────────────────────┘
```

### 4.8 Dashboard — `src/app/(app)/dashboard/page.tsx`

Añadir `recommendSystemNow(userId)` al `Promise.all`. Añadir `RecommendedSystemCard` en la columna derecha (debajo de `AdvisorCard` o en su lugar cuando no hay patrón activo).

### 4.9 UI — `src/features/systems/SystemDetailHeader.tsx`

Ampliar la sección de stats:
```tsx
<SystemStatsRow systemId={system.id} />  // Client component con useQuery
```

Los badges de `energyIdeal`, `triggerContext`, `expectedFrequency` reciben un `Tooltip` con explicación:
- `energyIdeal: "high"` → tooltip: "Este sistema requiere energía alta — ideal cuando estás en tu mejor momento"
- `triggerContext` → tooltip: "Contexto que activa este sistema"

### 4.10 MCP parity

Los tools `find_stale_systems` y `suggest_next_action` en MCP ya llaman a `getStaleSystems` y `getSuggestedTasks`. `recommendSystemNow` es un nuevo endpoint — añadir `recommend_system` como nuevo tool en `analyze.ts` que llame al mismo endpoint.

```typescript
// packages/mcp/src/tools/intelligence/analyze.ts
server.tool('recommend_system', 'Returns the system the user should focus on now based on current energy level and activity patterns.', {}, async () => {
  const result = await kinoFetch('/api/insights/recommend-system');
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
```

---

## 5. Plan de commits

### Commit 1 — `feat(insights): query de tareas pendientes por sistema`
Archivos: `src/features/insights/insights.queries.ts`

### Commit 2 — `feat(systems): query getSystemStats (completadas, tiempo, última actividad)`
Archivos: `src/features/systems/systems.queries.ts` (nuevo o en service)

### Commit 3 — `feat(insights): recommendSystemNow — algoritmo de scoring`
Archivos: `src/features/insights/insights.service.ts`

Incluye tests unitarios del scoring (función pura separada del DB fetch).

### Commit 4 — `feat(insights): ruta GET /api/insights/recommend-system`
Archivos:
- `src/features/insights/insights.routes.ts`
- `src/app/api/insights/recommend-system/route.ts` (nuevo)

### Commit 5 — `feat(insights): hook useRecommendedSystem`
Archivos: `src/features/insights/insights.hooks.ts`

### Commit 6 — `feat(dashboard): RecommendedSystemCard con razones de recomendación`
Archivos: `src/features/dashboard/RecommendedSystemCard.tsx` (nuevo)

### Commit 7 — `feat(systems): SystemStatsRow en SystemDetailHeader + tooltips en badges`
Archivos:
- `src/features/systems/SystemDetailHeader.tsx`
- `src/features/systems/SystemStatsRow.tsx` (nuevo, Client Component)

### Commit 8 — `feat(dashboard): integrar RecommendedSystemCard + stats en detalle`
Archivos: `src/app/(app)/dashboard/page.tsx`

### Commit 9 — `feat(mcp): agregar tool recommend_system`
Archivos: `packages/mcp/src/tools/intelligence/analyze.ts`

Verificar: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`

---

## 6. Tests

### Unitarios — scoring puro de `recommendSystemNow`
Separar la función de scoring en una función pura `scoreSystem(system, energyCategory, isStale, hasPendingTodayTasks)` → testeable sin DB.

```
scoreSystem:
  ✓ energyIdeal == categoria → score 3
  ✓ energyIdeal null → score 2
  ✓ stale + matching energy → score 5
  ✓ sin check-in → recommendSystemNow devuelve null
  ✓ solo inbox → devuelve null (is_inbox filtrado)
```

### Integración (manual)
- Check-in con energía alta → card recomienda sistema `energyIdeal: "high"`.
- Sistema sin actividad en 3+ días → aparece en recomendación aunque energía sea media.
- Sin check-in del día → card no aparece.
- Con check-in → badge con tooltip en `SystemDetailHeader` explica `energyIdeal`.

---

## 7. Checklist de seguridad

- [ ] `userId` de sesión en todos los endpoints
- [ ] Queries filtran `systems.user_id = userId`
- [ ] Inbox excluido de la recomendación (`is_inbox = false`)
- [ ] `getSystemStats` verifica propiedad del sistema antes de devolver datos

---

## 8. Riesgos y gotchas

- **Sin check-in hoy**: la función devuelve `null` y la card no se muestra. No es un error — es un estado válido. La UI debe manejar `null` gracefully.
- **Todos los sistemas tienen `energyIdeal: null`**: el scoring los trata como neutros (score 2). La recomendación cae sobre el más estale o con más pendientes. Sigue siendo útil.
- **`expectedFrequency` no tiene enum**: es `varchar(20)`. Los valores posibles no están documentados. Antes de añadir lógica sobre este campo, verificar qué valores existen en DB (no asumas un enum que no existe).
- **`getSystemStats` con `time_logs`**: solo hay datos si el usuario usó el Focus Timer (PLAN-04 prerequisito conceptual, aunque no técnico). Mostrar `minutesSpent` con estado vacío graceful ("sin datos de timer").
