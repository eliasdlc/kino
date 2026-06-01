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
| Service | `insights.service.ts:99` — `getEnergyDistribution` | Funciona |
| Route | expuesta como `/api/insights/energy-distribution?days=N` | Funciona |
| MCP | `packages/mcp/src/tools/intelligence/analyze.ts:17` — `get_energy_distribution` | Funciona |
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
- **Primaria**: `SUM(time_logs.duration_minutes)` por sistema. Cero si no hay logs.
- **Secundaria**: puntos estimados (`high=5, medium=3, low=1`) de tareas `completedAt IS NOT NULL`.
- **Porcentaje**: calculado sobre minutos si `totalMinutes > 0`, sobre puntos si no.
- **UI**: muestra tiempo en `Xh Ym` cuando hay datos, `~N pts` cuando es estimado. El usuario sabe qué está viendo.

### "Drena vs. energiza"
```
energyGap = energyIdeal (numérico) − uso relativo (%)

energyIdeal:  high=3, medium=2, low=1
uso relativo: porcentaje del total del período

Si gap > +30% → "subutilizado" (gris)
Si gap ∈ [-20%, +30%] → "equilibrado" (verde)
Si gap < -20% → "drenando" (ámbar/rojo)
```

Esta función es pura y vive en el service. No toca el schema.

### Estructura del componente
`EnergyDistributionCard` es un Client Component (necesita selector de período con estado). Recibe datos iniciales SSR; al cambiar período hace fetch al endpoint vía TanStack Query.

---

## 4. Cambios por capa

### 4.1 Query — `src/features/insights/insights.queries.ts`

Extender `queryEnergyBySystem` para hacer `LEFT JOIN time_logs`:

```typescript
// Nuevo shape de resultado
export interface SystemEnergyRow {
  systemId: string;
  systemName: string;
  energyIdeal: string | null;     // nuevo: de systems.energy_ideal
  energyPoints: number;           // existente: puntos estimados
  minutesSpent: number;           // nuevo: SUM(time_logs.duration_minutes)
  tasksCompleted: number;
}
```

La query agrega `systems.energy_ideal` y hace `LEFT JOIN time_logs ON time_logs.system_id = systems.id AND time_logs.user_id = $userId AND time_logs.started_at >= $fromDate`. El `SUM(time_logs.duration_minutes)` va en el SELECT.

**Cuidado:** `time_logs.started_at` es el filtro correcto (no `tasks.completed_at`) para no mezclar períodos. El JOIN es sobre `time_logs` directamente al sistema, no pasando por tasks — porque el timer ya guarda `system_id`.

### 4.2 Service — `src/features/insights/insights.service.ts`

`getEnergyDistribution` actualizado:

```typescript
// Shape nuevo de retorno
{
  period: "7d",
  hasTimeLogs: boolean,        // true si algún sistema tiene minutesSpent > 0
  total: number,               // total minutos o total puntos según hasTimeLogs
  systems: [{
    systemId, systemName,
    minutesSpent,              // 0 si no hay time_logs
    energyPoints,
    percentage,                // sobre minutos o puntos según hasTimeLogs
    energyIdeal,               // "high" | "medium" | "low" | null
    drainSignal: "draining" | "balanced" | "underused" | null
  }]
}
```

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

El tool `get_energy_distribution` en `packages/mcp/src/tools/intelligence/analyze.ts` llama al mismo endpoint. Con el shape nuevo (backwards-compatible), automáticamente recibe los campos adicionales. **No requiere cambios en MCP.**

---

## 5. Plan de commits

### Commit 1 — `feat(insights): agregar tiempo real de time_logs a queryEnergyBySystem`
Archivos: `src/features/insights/insights.queries.ts`

Cambios:
- Añadir `LEFT JOIN time_logs` a la query existente.
- Agregar `systems.energy_ideal` al SELECT.
- Nuevo campo `minutesSpent` en el resultado.
- Actualizar `SystemEnergyRow` interface.

Verificar: `pnpm typecheck`

### Commit 2 — `feat(insights): híbrido energy/tiempo en getEnergyDistribution + drain signal`
Archivos: `src/features/insights/insights.service.ts`

Cambios:
- `getEnergyDistribution` usa los nuevos campos de la query.
- Lógica de `hasTimeLogs` y selección de métrica para `percentage`.
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
- [ ] Zod en el param `days` (ya existe, rango 1-90)
- [ ] Query filtra `tasks.userId = userId` y `time_logs.userId = userId`
- [ ] No expone datos de otros usuarios
- [ ] Respuesta de error normalizada

---

## 8. Riesgos y gotchas

- **LEFT JOIN time_logs puede devolver NULL en `minutesSpent`**: castear a `0` con `COALESCE`.
- **El JOIN time_logs usa `system_id` directamente** (no a través de tasks). Verificar que el timer store guarda el `systemId` correcto — sí lo hace (`timer.store.ts:27`).
- **Período de time_logs vs. período de tasks**: ambos usan `fromDate` como cutoff pero en columnas distintas (`time_logs.started_at` vs. `tasks.completed_at`). Es correcto — mide actividad dentro del período.
- **Tailwind color dinámico**: las barras usan el color del sistema. Usar `getSystemColor(system.color)` — ya safelisteado en `globals.css`.
- **Bento grid en mobile**: la card nueva en la fila inferior puede necesitar `col-span-full` en mobile. Verificar en viewport < 1024px.
