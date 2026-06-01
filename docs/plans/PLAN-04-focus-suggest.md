# PLAN-04 — Focus Mode: de timer a modo de trabajo consciente

> Prioridad: 4
> Rama: `feat/plan-04-focus-suggest`
> Depende de: PLAN-01 completo (reutiliza `recommendSystemNow` y `getSuggestedTasks`)
> Desbloquea: ninguno (pero enriquece PLAN-02 al generar más time_logs)

---

## 1. Contexto y diagnóstico

### Lo que existe hoy (commiteado en `feat/focus`)

| Capa | Archivo | Estado |
|---|---|---|
| Store | `src/features/tasks/timer.store.ts` | Completo — Zustand persistido en localStorage |
| Widget | `src/features/tasks/FocusTimerWidget.tsx` | Completo — overlay flotante con contador y stop |
| API | `src/app/api/tasks/[id]/time-log/route.ts` | Completo — guarda `time_log` al parar |
| TaskCard | `src/features/tasks/TaskCard.tsx` | Botón timer integrado |
| TaskDetailSheet | `src/features/tasks/TaskDetailSheet.tsx` | Botón timer integrado |
| `src/features/focus/` | Directorio vacío | FALTA toda la capa de focus mode real |

### Lo que falta

1. **Sugerencia de qué enfocar**: cuando no hay timer activo, mostrar "con tu energía actual, enfócate en esto" usando `getSuggestedTasks` (ya existe) cruzado con el check-in de hoy.
2. **Modo aislamiento**: una vista dedicada que oculte el ruido y muestre solo la tarea activa + timer. El timer flotante actual es un HUD, no un modo.
3. **Context energy en el timer**: el widget sabe `taskId` pero no te dice "esta tarea es medium energy y tu energía actual está alta — aprovecha mejor". Feedback de alineación energética.
4. **Historial de sesiones**: el usuario no puede ver cuánto tiempo enfocó hoy/esta semana. Los `time_logs` se guardan pero no se muestran.

### Relación con otros planes

- `getSuggestedTasks(userId, energyLevel)` viene de `insights.service.ts` (PLAN-01 lo expande con `recommendSystemNow`, pero `getSuggestedTasks` ya existe y se puede usar ahora).
- Los `time_logs` generados por el timer alimentan el analytics híbrido de PLAN-02.
- `pnpm db:push` necesario si no se corrió después del commit de `feat(energy)` (nuevas columnas en `userEnergyProfile`).

---

## 2. Objetivo y criterios de aceptación

- [ ] Cuando no hay timer activo: el `FocusTimerWidget` o un card en el dashboard sugiere la siguiente tarea según energía actual.
- [ ] Ruta `/focus` muestra una vista de focus mode: tarea activa ampliada, timer, botón completar, botón cancelar foco.
- [ ] El timer muestra un indicador de alineación energética: si la tarea es `high` energy pero la energía del usuario es `low`, avisa suavemente.
- [ ] Un panel "Sesiones de hoy" en el dashboard (o en `/focus`) muestra los `time_logs` del día: tarea, sistema, duración.
- [ ] `pnpm typecheck && pnpm lint && pnpm build && pnpm test` pasan.

---

## 3. Decisiones de diseño

### Sugerencia de tarea (cuando no hay timer)

El `FocusTimerWidget` cuando `active === null` → invisible (comportamiento actual). La sugerencia va en un **nuevo card del dashboard**: "¿Qué enfocar ahora?"

Cuando hay check-in del día: llama a `GET /api/insights/suggest?energyLevel={currentLevel}` y muestra la top tarea con botón "Enfocar → [inicia timer]".

Cuando no hay check-in: muestra el check-in prompt en su lugar ("Primero dinos cómo estás").

### Ruta `/focus`

Una página `src/app/(app)/focus/page.tsx` que:
1. Lee el timer activo desde el store (client-side).
2. Si hay timer activo: muestra la tarea ampliada + cronómetro grande + completar + cancelar.
3. Si no hay timer: redirige a `/dashboard` o muestra "selecciona una tarea para enfocar".

El layout `/focus` puede suprimir la sidebar (`SystemsSidebar`) para aislamiento visual. Esto se controla con una clase en el `<body>` o pasando un flag de layout.

### Indicador de alineación energética

En `FocusTimerWidget`, al lado del título de tarea, un ícono pequeño:
- 🟢 tarea `energyLevel` == energía actual del check-in → alineado
- 🟡 un nivel de diferencia → info
- 🔴 opuesto (high task + low energy) → advertencia suave

La energía actual del check-in se lee desde `useTimerStore` (ya tiene `taskId`) + una query al check-in de hoy. No requiere schema nuevo.

### Historial de sesiones del día

Nueva query `getTodayTimeLogs(userId)` → `time_logs WHERE date(started_at) = today AND user_id = userId`. Se muestra en un card "Sesiones de hoy" en el dashboard o en `/focus`.

---

## 4. Cambios por capa

### 4.1 Queries — `src/features/tasks/tasks.queries.ts` o `src/features/energy/energy.queries.ts`

Nueva función `getTodayTimeLogs(userId)`:
```typescript
interface TimeLogRow {
  id: string;
  taskId: string;
  taskTitle: string;
  systemId: string;
  systemName: string;
  startedAt: string;
  durationMinutes: number;
}
```

Query: `SELECT time_logs.*, tasks.title, systems.name FROM time_logs INNER JOIN tasks INNER JOIN systems WHERE time_logs.user_id = userId AND DATE(time_logs.started_at) = today_utc ORDER BY started_at DESC`.

Ubicación: puede ir en `src/features/tasks/tasks.queries.ts` (es una query sobre tareas/logs) o en un nuevo `src/features/focus/focus.queries.ts`. Preferible el segundo para empezar a poblar el directorio `focus/` con sentido.

### 4.2 Service — `src/features/focus/focus.service.ts` (nuevo)

```typescript
export async function getTodayFocusSessions(userId: string): Promise<TimeLogRow[]>
export async function getFocusSuggestion(userId: string): Promise<SuggestedTask | null>
```

`getFocusSuggestion`:
1. Obtener check-in de hoy → `currentLevel`.
2. Si no hay check-in → `null`.
3. Mapear `currentLevel` a `energyLevel` (≥70→high, ≥40→medium, else low).
4. Llamar `getSuggestedTasks(userId, energyLevel, 1)` de `insights.service.ts`.
5. Devolver la top tarea con metadata de alineación.

**Regla de vertical slice**: `focus.service.ts` importa desde `insights.service.ts` vía su interfaz pública (función exportada). No importa internals de insights.

### 4.3 Route — `src/features/focus/focus.routes.ts` (nuevo)

```typescript
// GET /api/focus/suggestion → getFocusSuggestion
// GET /api/focus/sessions/today → getTodayFocusSessions
```

### 4.4 API Routes (nuevos)

```
src/app/api/focus/suggestion/route.ts
src/app/api/focus/sessions/today/route.ts
```

### 4.5 Hooks — `src/features/focus/focus.hooks.ts` (nuevo)

```typescript
export function useFocusSuggestion(): UseQueryResult<SuggestedTask | null>
export function useTodaySessions(): UseQueryResult<TimeLogRow[]>
```

- `useFocusSuggestion`: key `['focus-suggestion']`, staleTime 2 min (cambia con el check-in).
- `useTodaySessions`: key `['focus-sessions-today']`, staleTime 1 min, `refetchOnWindowFocus: true`.

### 4.6 UI — `src/features/focus/FocusSuggestionCard.tsx` (nuevo)

Client Component. Se integra en el dashboard.

```
┌────────────────────────────────────────┐
│ ⚡ ¿Qué enfocar ahora?                 │
│                                        │
│ Tu energía: alta                       │
│                                        │
│ → Revisar propuesta de cliente X       │
│   Sistema: Proyectos · High energy ✓  │
│   Prioridad: alta · Vence hoy         │
│                                        │
│   [▶ Enfocar]      [Ver más]          │
└────────────────────────────────────────┘
```

El botón "Enfocar" llama a `useTimerStore.startTimer(task.id, task.systemId, task.title)` y navega a `/focus`.

### 4.7 UI — `src/features/focus/TodaySessionsCard.tsx` (nuevo)

```
┌────────────────────────────────────────┐
│ 🕐 Sesiones de hoy         2h 15m total│
│                                        │
│ 45m  Revisar propuesta    Proyectos   │
│ 30m  Standup equipo       Meetings    │
│ 60m  Diseño UI sprint 3   Proyectos   │
└────────────────────────────────────────┘
```

### 4.8 Página — `src/app/(app)/focus/page.tsx` (nuevo)

Server component que detecta si hay sesión activa (lee el store en client). En la práctica, Client Component (necesita `useTimerStore`).

```
Vista focus activo:
┌───────────────────────────────────┐
│          ◉ EN FOCO                │
│                                   │
│   Revisar propuesta cliente X     │
│   Proyectos · Alta energía        │
│                                   │
│         01:23:45                  │
│                                   │
│  🟡 Tu energía está media pero    │
│     esta tarea requiere alta      │
│                                   │
│  [✓ Completar]   [✗ Cancelar]    │
└───────────────────────────────────┘
```

El indicador de alineación usa `active.taskId` para buscar la tarea (caché de TanStack Query) y el check-in del día para la energía actual.

Layout: sin sidebar, pantalla completa centrada.

### 4.9 Dashboard — `src/app/(app)/dashboard/page.tsx`

Añadir `getTodayFocusSessions(userId)` al `Promise.all`. Añadir `FocusSuggestionCard` y `TodaySessionsCard` al grid (probablemente en la fila inferior).

### 4.10 Timer widget — `src/features/tasks/FocusTimerWidget.tsx`

Añadir indicador de alineación energética. Requiere:
1. Leer el check-in actual (`useTodayCheckin` hook — ya existe en `energy.hooks.ts`).
2. Comparar con `energyLevel` de la tarea activa.
3. Mostrar dot de color (verde/amarillo/rojo) en el widget.

El `energyLevel` de la tarea activa no está en el store. Opciones:
- **Opción A**: añadir `taskEnergyLevel` al store cuando se inicia el timer (en `startTimer`).
- **Opción B**: hacer query al task cuando el widget se monta.

**Decisión: Opción A** — el `startTimer` ya recibe los datos de la tarea desde `TaskCard`. Añadir `taskEnergyLevel` al `ActiveTimer` shape. Cambio mínimo.

---

## 5. Plan de commits

### Commit 1 — `feat(focus): queries getTodayTimeLogs y getFocusSuggestion`
Archivos:
- `src/features/focus/focus.queries.ts` (nuevo)
- `src/features/focus/focus.service.ts` (nuevo)

### Commit 2 — `feat(focus): rutas GET suggestion y sessions/today`
Archivos:
- `src/features/focus/focus.routes.ts` (nuevo)
- `src/app/api/focus/suggestion/route.ts` (nuevo)
- `src/app/api/focus/sessions/today/route.ts` (nuevo)

### Commit 3 — `feat(focus): hooks useFocusSuggestion y useTodaySessions`
Archivos: `src/features/focus/focus.hooks.ts` (nuevo)

### Commit 4 — `feat(timer): añadir taskEnergyLevel al ActiveTimer store`
Archivos:
- `src/features/tasks/timer.store.ts`
- `src/features/tasks/TaskCard.tsx` (pasa `energyLevel` al `startTimer`)
- `src/features/tasks/TaskDetailSheet.tsx` (ídem)

**Este commit actualiza el shape del store.** Verificar que el `localStorage` de usuarios existentes no rompa (añadir campo con fallback `'medium'` si está ausente — el `syncElapsed` puede limpiar).

### Commit 5 — `feat(focus): FocusSuggestionCard con botón "Enfocar"`
Archivos: `src/features/focus/FocusSuggestionCard.tsx` (nuevo)

### Commit 6 — `feat(focus): TodaySessionsCard con resumen de tiempo`
Archivos: `src/features/focus/TodaySessionsCard.tsx` (nuevo)

### Commit 7 — `feat(focus): página /focus con modo aislamiento`
Archivos:
- `src/app/(app)/focus/page.tsx` (nuevo)
- Ajuste de layout si es necesario para suprimir sidebar

### Commit 8 — `feat(focus): indicador de alineación energética en FocusTimerWidget`
Archivos: `src/features/tasks/FocusTimerWidget.tsx`

### Commit 9 — `feat(dashboard): integrar FocusSuggestionCard y TodaySessionsCard`
Archivos: `src/app/(app)/dashboard/page.tsx`

Verificar: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`

---

## 6. Tests

### Unitarios — `src/features/focus/focus.service.test.ts`
```
getFocusSuggestion:
  ✓ sin check-in → null
  ✓ currentLevel 75 → energyLevel 'high' → filtra tareas high
  ✓ currentLevel 50 → energyLevel 'medium'
  ✓ currentLevel 20 → energyLevel 'low'

indicador de alineación (función pura):
  ✓ task high + user high → 'aligned'
  ✓ task high + user low → 'misaligned'
  ✓ task medium + user high → 'info'
```

### Integración (manual)
- Check-in con energía alta → card sugiere tarea `energyLevel: 'high'`.
- Botón "Enfocar" → navega a `/focus` con timer activo.
- Timer activo con tarea misaligned → badge rojo visible en widget.
- Parar timer → aparece en `TodaySessionsCard`.

---

## 7. Checklist de seguridad

- [ ] `userId` de sesión en todos los endpoints de focus
- [ ] `getTodayTimeLogs` filtra `time_logs.user_id = userId`
- [ ] No exponer `time_logs` de otros usuarios
- [ ] Página `/focus` requiere sesión autenticada (via layout de `(app)`)

---

## 8. Riesgos y gotchas

- **Store migration (`taskEnergyLevel` nuevo campo)**: el `persist` de Zustand deserializa el estado del localStorage. Si un usuario tiene timer activo sin `taskEnergyLevel`, el campo será `undefined`. Añadir `taskEnergyLevel: active?.taskEnergyLevel ?? 'medium'` en `syncElapsed` o en el selector.
- **Sidebar en `/focus`**: suprimir la sidebar requiere modificar el layout de `(app)`. Opciones: layout anidado en `(app)/focus/layout.tsx` que omite `SystemsSidebar`, o un param de ruta que el layout parent lee. La primera opción es más limpia en Next.js App Router.
- **`getFocusSuggestion` importa de `insights.service.ts`**: ese import cruza slices (`focus` → `insights`). Es aceptable porque lo hace a través de la interfaz pública (función exportada), no internals. Documentarlo en el archivo.
- **`useTodaySessions` con fecha UTC**: el `DATE(time_logs.started_at)` en la query usa UTC. Si el usuario está en zona horaria -5, las sesiones de 00:00-05:00 local caen en el día anterior UTC. Usar `AT TIME ZONE` con la timezone del usuario, igual que en `getCompletedTasksLast90Days`.
