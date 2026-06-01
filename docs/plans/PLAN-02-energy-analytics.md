# PLAN-02 — Energy Analytics: distribución de energía por sistema

> Prioridad: 1 (cosecha lo que ya existe)
> Rama: `feat/plan-02-energy-analytics`
> Depende de: ninguno
> Desbloquea: PLAN-04 (el analytics se enriquece con time_logs del timer)

---

## 1. Contexto y diagnóstico

### Lo que existe hoy

| Capa | Archivo | Estado |
|---|---|---|
| Query | `insights.queries.ts:18` — `queryEnergyBySystem` | Funciona, solo puntos estimados |
| Service | `insights.service.ts:100` — `getEnergyDistribution` | Funciona |
| Route | `insights.routes.ts:34` — `getEnergyDistributionRoute` (`/api/insights/energy-distribution?days=N`) | Funciona |
| MCP | `packages/mcp/src/tools/intelligence/analyze.ts:15` — `get_energy_distribution` | Funciona |
| **UI** | **No existe ningún componente que lo renderice** | **FALTA** |

### El problema de las dos métricas

`queryEnergyBySystem` calcula energía como puntos por tarea completada (`high=5, medium=3, low=1`). Es una estimación. El Focus Timer (commiteado en `feat/focus`) empieza a producir `time_logs` reales con `durationMinutes`. Ambas métricas deben coexistir.

Decisión tomada: **híbrido**. Mostrar tiempo real cuando hay `time_logs`, puntos estimados como complemento.

### El problema adicional: "drena vs. energiza"

Un sistema marcado `energyIdeal: low` que consume el 40% del tiempo = está drenando. Un sistema marcado `energyIdeal: high` que consume el 5% = está siendo subutilizado. Esta comparación cruzada no existe en ninguna capa hoy.

---

## 2. Objetivo y criterios de aceptación

- [ ] El dashboard muestra una card "Distribución de energía" con barras horizontales por sistema.
- [ ] Las barras muestran tiempo real (minutos de `time_logs`) cuando hay datos; puntos estimados como fallback.
- [ ] El porcentaje usa la métrica disponible (tiempo real prioritario).
- [ ] El selector de período: 7d / 14d / 30d (default 7d).
- [ ] Cada barra incluye un indicador "drena / neutro / energiza" basado en `energyIdeal` vs. uso real.
- [ ] El endpoint MCP `get_energy_distribution` sigue funcionando sin cambios (misma respuesta, datos más ricos).
- [ ] `pnpm typecheck && pnpm lint && pnpm build && pnpm test` pasan.

---

## 3. Decisiones de diseño

### Métrica de energía (híbrido)
- **Primaria (UI)**: `SUM(time_logs.duration_minutes)` por sistema (`minutesSpent`). Cero si no hay logs.
- **Secundaria (existente)**: puntos estimados (`high=5, medium=3, low=1`) de tareas `completedAt IS NOT NULL` (`energySpent`).
- **Porcentaje**: el campo existente `percentage` se mantiene sobre puntos (`energySpent`) por backwards-compatibility con el MCP. Para el % por tiempo real la UI usa un campo **nuevo** `percentageByMinutes` (sobre `totalMinutes`), sin redefinir el existente.
- **UI**: cuando `hasTimeLogs`, muestra tiempo en `Xh Ym` y usa `percentageByMinutes`; si no, muestra `~N pts` y usa `percentage`. El usuario sabe qué está viendo.

### "Drena vs. energiza"
```
energyGap = energyIdeal (numérico) − uso relativo (%)

energyIdeal:  high=3, medium=2, low=1
uso relativo: porcentaje del total del período. Conceptualmente "drena vs energiza" mide tiempo REAL, así que cuando `hasTimeLogs` conviene alimentar `computeDrainSignal` con `percentageByMinutes`; si no hay logs, con `percentage` (puntos). La función es pura y agnóstica: recibe el porcentaje ya elegido.

Si gap > +30% → "subutilizado" (gris)
Si gap ∈ [-20%, +30%] → "equilibrado" (verde)
Si gap < -20% → "drenando" (ámbar/rojo)
```

Esta función es pura y vive en el service. No toca el schema.

> **Decisión del desarrollador (escala de la fórmula):** tal como está escrita, `energyGap = energyIdeal − uso%` mezcla escalas (`energyIdeal` ∈ {1,2,3} vs `uso%` ∈ [0,100]), por lo que `gap` siempre será negativo y los umbrales `+30%/-20%` no calzan. Hay que normalizar antes de comparar: p.ej. mapear `energyIdeal` a un % esperado (low≈11%, medium≈22%, high≈33% — o el reparto que se decida) y comparar `usoReal% − esperado%`. Definir el mapeo concreto al implementar; los tests de §6 deben fijarse contra el mapeo elegido.

### Estructura del componente
`EnergyDistributionCard` es un Client Component (necesita selector de período con estado). Recibe datos iniciales SSR; al cambiar período hace fetch al endpoint vía TanStack Query.

---

## 4. Cambios por capa

### 4.1 Query — `src/features/insights/insights.queries.ts`

> **El campo existente se llama `energySpent`, NO `energyPoints`** (ver `insights.queries.ts:14` y `insights.service.ts:106`). El MCP serializa la respuesta completa con `JSON.stringify` (`analyze.ts:30`), así que renombrar ese campo rompería al consumidor. Mantener `energySpent` y solo AÑADIR campos nuevos.

Shape de resultado (campos nuevos añadidos, `energySpent` se conserva):

```typescript
// Shape de resultado actualizado
export interface SystemEnergyRow {
  systemId: string;
  systemName: string;
  systemColor: string;            // nuevo: systems.color (colorEnum, NO hex) — para los puntos de la UI
  energyIdeal: string | null;     // nuevo: de systems.energy_ideal
  energySpent: number;            // existente: puntos estimados (SIN renombrar)
  minutesSpent: number;           // nuevo: SUM(time_logs.duration_minutes)
  tasksCompleted: number;
}
```

**Gotcha crítico — fan-out / producto cartesiano.** `queryEnergyBySystem` parte `FROM tasks INNER JOIN systems` y agrupa por sistema. Si se añade un `LEFT JOIN time_logs ON system_id` directamente sobre esa misma query, dentro de cada `GROUP BY system` se produce el producto cartesiano de N tasks × M time_logs, lo que **infla** `SUM(energySpent)`, `SUM(duration_minutes)` y `COUNT(*)`. NO hacer un solo JOIN combinado.

**Corrección (opción recomendada): dos agregaciones separadas, mergeadas en el service.**
- Mantener `queryEnergyBySystem` tal cual (tasks completadas → `energySpent`, `tasksCompleted`), añadiendo solo `systems.energyIdeal` al SELECT y al `groupBy`.
- Añadir una nueva query `queryMinutesBySystem(userId, fromDate)` que agregue `time_logs` por su cuenta: `SELECT system_id, SUM(duration_minutes)::int AS minutesSpent FROM time_logs WHERE user_id = $userId AND started_at >= $fromDate GROUP BY system_id`. Una fila por sistema, sin fan-out.
- El service mergea ambos resultados por `systemId` (`Map<string, ...>`), uniendo sistemas que aparecen en una u otra fuente.

**Alternativa (un solo statement): subquery agregada.** Pre-agregar `time_logs` en una subquery (`SELECT system_id, SUM(duration_minutes) ... GROUP BY system_id`) que devuelve **una fila por sistema**, y recién entonces hacer `LEFT JOIN` de esa subquery contra la query de tasks. Evita el fan-out porque la subquery ya colapsó los time_logs. Más compacto pero más difícil de leer en Drizzle; requiere `sql` para la subquery.

> Decisión del desarrollador: las dos agregaciones separadas (recomendada) son más legibles y testeables; la subquery ahorra un round-trip. Ambas son correctas — elegir según preferencia.

**Cuidado:** `time_logs.started_at` es el filtro correcto (no `tasks.completed_at`) para no mezclar períodos. La agregación de minutos es sobre `time_logs` directamente al sistema, no pasando por tasks — porque el timer ya guarda `system_id` (`timer.store.ts:8,27`).

### 4.2 Service — `src/features/insights/insights.service.ts`

`getEnergyDistribution` actualizado:

```typescript
// Shape de retorno actualizado (backwards-compatible: solo añade campos)
{
  period: "7d",
  total: number,               // existente: total puntos estimados (SIN cambiar semántica)
  hasTimeLogs: boolean,        // nuevo: true si algún sistema tiene minutesSpent > 0
  totalMinutes: number,        // nuevo: SUM de minutesSpent de todos los sistemas
  systems: [{
    systemId, systemName,
    systemColor,               // nuevo: colorEnum para los puntos de la UI
    energySpent,               // existente (NO renombrar — lo lee el MCP)
    tasksCompleted,            // existente
    percentage,                // existente: sobre energySpent (NO redefinir)
    percentageByMinutes,       // nuevo: sobre totalMinutes (0 si no hay logs)
    minutesSpent,              // nuevo: 0 si no hay time_logs
    energyIdeal,               // nuevo: "high" | "medium" | "low" | null
    drainSignal: "draining" | "balanced" | "underused" | null  // nuevo
  }]
}
```

> **Backwards-compatibility:** `energySpent`, `tasksCompleted`, `total` y `percentage` se conservan con su semántica actual. Para no romper al MCP, `percentage` sigue calculándose sobre puntos (`energySpent`). Si la UI quiere mostrar el % por tiempo real, añadir un campo NUEVO `percentageByMinutes` en lugar de redefinir `percentage`.

Nueva función pura `computeDrainSignal(energyIdeal, percentage)` → `DrainSignal`. Recibe el `energyIdeal` del sistema y el porcentaje de uso. Devuelve la señal según la fórmula de la sección 3.

### 4.3 Route — `src/features/insights/insights.routes.ts`

Sin cambios en la firma. La respuesta JSON es backwards-compatible (campos nuevos añadidos, ninguno eliminado).

### 4.4 Hook — nuevo archivo `src/features/insights/insights.hooks.ts`

```typescript
// useEnergyDistribution(days: number)
// TanStack Query, key: ['energy-distribution', days]
// GET /api/insights/energy-distribution?days={days}
// staleTime: 5 * 60 * 1000 (5 min — no necesita ser tiempo real)
```

### 4.5 UI — nuevo archivo `src/features/dashboard/EnergyDistributionCard.tsx`

Client Component. Props:
```typescript
interface EnergyDistributionCardProps {
  initialData: EnergyDistributionResult;  // hidratación SSR
}
```

Estructura visual:
```
┌─────────────────────────────────────────┐
│ Distribución de energía      [7d][14d][30d] │
├─────────────────────────────────────────┤
│ 🔴 Proyectos   ████████░░  62%  4h 20m  ⚡drenando  │
│ 🔵 Meetings    ████░░░░░░  28%  1h 55m  ✓equilibrado │
│ 🟢 Admin       ██░░░░░░░░  10%  ~8 pts  ↑subutilizado│
│                                         │
│ Fuente: tiempo real + ~estimado         │
└─────────────────────────────────────────┘
```

Cuando no hay datos del período: estado vacío con mensaje "Completa tareas o usa el timer para ver tu distribución".

### 4.6 Dashboard — `src/app/(app)/dashboard/page.tsx`

Añadir `getEnergyDistribution(userId, 7)` al `Promise.all` del server component. Pasar `initialData` al `EnergyDistributionCard`. Ubicación: nueva celda en la fila inferior del bento grid.

### 4.7 MCP parity

El tool `get_energy_distribution` en `packages/mcp/src/tools/intelligence/analyze.ts:15` llama al mismo endpoint y serializa la respuesta completa con `JSON.stringify(distribution, null, 2)` (`analyze.ts:30`). Como **NO se renombra ni elimina ningún campo existente** (`energySpent`, `tasksCompleted`, `total`, `percentage` intactos) y solo se AÑADEN campos (`minutesSpent`, `energyIdeal`, `drainSignal`, `hasTimeLogs`, `totalMinutes`, `percentageByMinutes`), el cambio es realmente backwards-compatible: el MCP recibe los campos extra sin romperse. **No requiere cambios en MCP.**

> Esto solo se cumple si §4.1 y §4.2 respetan la regla de "solo añadir". Si en algún momento se renombrara `energySpent`, este tool se rompería y habría que actualizarlo.

---

## 5. Plan de commits

### Commit 1 — `feat(insights): agregar agregación de minutos de time_logs por sistema`
Archivos: `src/features/insights/insights.queries.ts`

Cambios:
- Añadir `systems.energyIdeal` y `systems.color` al SELECT y al `groupBy` de `queryEnergyBySystem`; añadir `energyIdeal` y `systemColor` a `SystemEnergyRow` (mantener `energySpent`, NO renombrar).
- Crear `queryMinutesBySystem(userId, fromDate)`: agrega `SUM(duration_minutes)` por `system_id` directamente sobre `time_logs` (una fila por sistema, sin fan-out). Filtra `time_logs.userId = userId` y `time_logs.startedAt >= fromDate`.
- **NO** añadir un `LEFT JOIN time_logs` a `queryEnergyBySystem` — produciría producto cartesiano N tasks × M time_logs e inflaría `energySpent`/`tasksCompleted` (ver §4.1).

Verificar: `pnpm typecheck`

### Commit 2 — `feat(insights): híbrido energy/tiempo en getEnergyDistribution + drain signal`
Archivos: `src/features/insights/insights.service.ts`

Cambios:
- `getEnergyDistribution` llama a `queryEnergyBySystem` y `queryMinutesBySystem` y mergea por `systemId` (`Map`), incluyendo sistemas que solo aparezcan en una de las dos fuentes.
- Calcular `hasTimeLogs`, `totalMinutes` y el nuevo `percentageByMinutes` (sin redefinir `percentage`, que sigue sobre `energySpent`).
- Nueva función pura `computeDrainSignal`.
- Campo `drainSignal` en cada sistema del resultado.

Verificar: `pnpm typecheck && pnpm test` (añadir tests unitarios para `computeDrainSignal` — función pura, fácil de testear)

### Commit 3 — `feat(insights): hook useEnergyDistribution`
Archivos: `src/features/insights/insights.hooks.ts` (nuevo)

Cambios:
- Hook TanStack Query con key `['energy-distribution', days]`.
- Selector de período como parámetro.
- `staleTime: 5 * 60 * 1000`.

Verificar: `pnpm typecheck`

### Commit 4 — `feat(dashboard): EnergyDistributionCard con selector de período`
Archivos: `src/features/dashboard/EnergyDistributionCard.tsx` (nuevo)

Cambios:
- Client Component con selector 7d/14d/30d.
- Barras horizontales con color del sistema.
- Indicador de drain signal.
- Estado vacío.
- Hidratación SSR desde `initialData`.

Verificar: `pnpm typecheck && pnpm lint`

### Commit 5 — `feat(dashboard): integrar EnergyDistributionCard en bento grid`
Archivos: `src/app/(app)/dashboard/page.tsx`

Cambios:
- Añadir `getEnergyDistribution(userId, 7)` al `Promise.all`.
- Añadir `EnergyDistributionCard` al grid.
- Ajustar layout del bento si es necesario.

Verificar: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`

---

## 6. Tests

### Unitarios (en `src/features/insights/insights.service.test.ts` — nuevo)
```
computeDrainSignal:
  ✓ sistema high ideal + 60% uso → "balanced"
  ✓ sistema low ideal + 50% uso → "draining"
  ✓ sistema high ideal + 5% uso → "underused"
  ✓ energyIdeal null → null
  ✓ percentage 0 → "underused" si ideal != low
```

### Integración (manual — verificar en browser)
- Completar varias tareas en sistemas distintos → card muestra distribución.
- Usar Focus Timer en tareas → columna "tiempo real" aparece.
- Cambiar selector de período → datos se actualizan.
- Sin datos → estado vacío visible.

---

## 7. Checklist de seguridad

- [ ] `userId` de sesión en el endpoint (ya validado en `getAuthContext`)
- [ ] Validación del param `days` (la route ya lo clampa a 1-90 con `parseInt` + guard en `insights.routes.ts:37-38`; no usa Zod aquí, es validación manual de un único query param numérico)
- [ ] Query filtra `tasks.userId = userId` y `time_logs.userId = userId`
- [ ] No expone datos de otros usuarios
- [ ] Respuesta de error normalizada

---

## 8. Riesgos y gotchas

- **Fan-out**: NO combinar tasks y time_logs en un solo JOIN agregado (producto cartesiano). Usar dos agregaciones separadas mergeadas en el service, o subquery pre-agregada (§4.1).
- **Sistemas sin time_logs**: al mergear por `systemId`, un sistema presente solo en `queryEnergyBySystem` debe quedar con `minutesSpent = 0` (default en el merge, no `null`).
- **La agregación de minutos usa `system_id` directamente** (no a través de tasks). El timer store guarda el `systemId` correcto — sí lo hace (`timer.store.ts:8,27`).
- **Período de time_logs vs. período de tasks**: ambos usan `fromDate` como cutoff pero en columnas distintas (`time_logs.started_at` vs. `tasks.completed_at`). Es correcto — mide actividad dentro del período.
- **El color del sistema NO está en el resultado actual**: `queryEnergyBySystem` selecciona solo `systemId`, `systemName` (`insights.queries.ts:23-27`), no `systems.color`. La card muestra puntos de color por sistema, así que hay que **añadir `systems.color` al SELECT** (es `colorEnum`, NO hex — gotcha conocido) y propagarlo por el merge del service hasta el resultado.
- **Tailwind color dinámico**: `getSystemColor(color)` devuelve un TOKEN (p.ej. `"red-500"`), no una clase completa — componer como `bg-${token}` / `bg-${token}/10` (`system-colors.ts:18`). Las clases `bg-{color}-500`, `bg-{color}-500/10` y `text-{color}-500` ya están safelisteadas con `@source inline(...)` en `globals.css:8-10`.
- **Bento grid en mobile**: la card nueva en la fila inferior puede necesitar `col-span-full` en mobile. Verificar en viewport < 1024px.
