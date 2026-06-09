# Kino — Decisiones de Ingeniería (companion de PLAN.md)

> Estado: activo · 2026-06-08
> **Propósito**: PLAN.md define *qué* y el *producto*. Este doc define *cómo* a nivel técnico:
> algoritmos, patrones, librerías y gotchas. La regla es: si Claude Code se topa con una
> decisión de implementación que no requiere criterio de producto, la respuesta está aquí.
> No re-decidir. No improvisar un patrón distinto al estándar global.

---

## 0. Estándares globales (aplican a TODAS las fases)

Estos no se vuelven a decidir en ninguna fase. Son el default.

### 0.1 Data fetching → TanStack Query

- **Toda lectura de servidor pasa por TanStack Query** (`@tanstack/react-query`). Cero `fetch` suelto en componentes, cero `useEffect + setState` para data de servidor.
- **Verificar una vez** en `package.json`. Si no está → instalarlo es la decisión (no buscar alternativa). Es la base de todos los optimistic updates del plan.
- **Query key factory** centralizado en `lib/queryKeys.ts`. Nada de strings inline:
  ```ts
  export const qk = {
    dashboard: (date: string) => ['dashboard', date] as const,
    suggestedTasks: (date: string) => ['suggested-tasks', date] as const,
    tasks: (filters: TaskFilters) => ['tasks', filters] as const,
    task: (id: string) => ['task', id] as const,
    systemTasks: (systemId: string) => ['system', systemId, 'tasks'] as const,
    energy: (date: string) => ['energy', date] as const,
    timeLogs: (taskId: string) => ['time-logs', taskId] as const,
  };
  ```
- **staleTime por tipo de dato**:
  - Dashboard / energía / suggested: `staleTime: 60_000` (1 min). Datos que cambian con acciones del usuario.
  - Listas de tareas: `staleTime: 30_000`.
  - Curva de energía aprendida / patrones (cambian lento): `staleTime: 5 * 60_000`.
- **No** `refetchOnWindowFocus` global salvo en dashboard y energía (ahí sí, para reflejar checkins hechos en mobile).

### 0.2 Mutaciones → optimistic update con rollback (patrón único)

Todas las acciones inline del plan (completar, mover, quitar del plan, agregar al plan, mover de día en Planning) usan **este mismo patrón**, sin excepción:

```ts
const mutation = useMutation({
  mutationFn: api.completeTask,
  onMutate: async (vars) => {
    await queryClient.cancelQueries({ queryKey: qk.tasks(filters) });
    const prev = queryClient.getQueryData(qk.tasks(filters));
    queryClient.setQueryData(qk.tasks(filters), optimisticPatch(prev, vars));
    return { prev };
  },
  onError: (_e, _vars, ctx) => {
    queryClient.setQueryData(qk.tasks(filters), ctx.prev); // rollback
    toast.error('No se pudo guardar. Intenta de nuevo.');
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: qk.tasks(filters) }),
});
```

Regla: **UI optimista siempre, rollback en error, invalidate en settled.** No esperar al server para reflejar el cambio visual.

### 0.3 Validación → Zod compartido cliente/servidor

- **Una sola fuente** por entidad en `packages/shared` (o `lib/schemas/`), importada por backend (Fastify/route handler) y frontend (form).
- El backend **siempre** valida con el mismo schema aunque el cliente ya validó. Nunca confiar en validación de cliente.
- `userId` **siempre** de sesión, nunca del body (ya está en PLAN.md — se reafirma como invariante).
- Reglas de coherencia (Fase 4.5) → `.superRefine()` en el schema compartido, no `if` dispersos.

### 0.4 Formularios → react-hook-form + zodResolver

- **Verificar una vez**: si `react-hook-form` está en el proyecto, es el estándar para CreateTaskDialog y TaskDetailSheet. Si no está, instalarlo es la decisión.
- Multi-step (Fase 3.1) = **un solo form**, pasos = render condicional. No un form por paso. Avance de paso = `await form.trigger([...camposDelPaso])` antes de pasar.

### 0.5 Estado: dónde vive cada cosa

| Tipo de estado | Herramienta | Ejemplos |
|---|---|---|
| Server state | TanStack Query | tareas, energía, sugerencias, timeLogs |
| Filtros de `/tasks` | URL (`useSearchParams`) | estado, sistema, prioridad, agrupar, ordenar |
| UI efímera | `useState` / `useReducer` | paso del dialog, hover, colapsado/expandido |
| Timer activo (cross-route) | React Context en root | sesión Pomodoro activa |
| Caché "plan del día" | `useRef` + dateKey | sugerencias generadas 1×/día |

**No introducir Zustand/Redux/Jotai.** El plan no lo necesita y agrega superficie. Context solo para el timer (es el único estado verdaderamente global y cross-route).

### 0.6 Fechas y "hoy" → un solo helper, timezone-aware

Este es el gotcha #1 del plan (todo gira alrededor de "hoy", `dueDate`, slots, "vencidas"). Decisión:

- Crear `lib/dateKeys.ts` con **todas** las operaciones de fecha. Prohibido `new Date()` ad-hoc para comparar fechas de negocio.
  ```ts
  // tz del usuario si existe en profile; fallback configurado.
  const USER_TZ_FALLBACK = 'America/Santo_Domingo';
  export function todayKey(tz = USER_TZ_FALLBACK): string // 'YYYY-MM-DD'
  export function isOverdue(dueDate: string | null, tz?): boolean
  export function currentSlot(tz?): 'morning'|'afternoon'|'evening' // 6-12 / 12-18 / 18-24
  export function currentHour(tz?): number
  ```
- `dueDate`/`startDate` son columnas **DATE** (sin hora). Comparar siempre como string `YYYY-MM-DD`, nunca como `Date` con hora (evita off-by-one por UTC).
- **El cálculo de "hoy" y de slots para lógica de negocio (qué tareas son vencidas, qué slot toca) se hace en el backend** usando la tz del usuario. El cliente solo pinta. Esto evita que un cliente con reloj/tz mal puesto corrompa el plan.
- Librería: `date-fns` + `date-fns-tz`. Si ya hay `date-fns`, no traer otra (no Luxon, no Day.js, no Temporal).

### 0.7 Toasts y notificaciones in-app → sonner

- Estándar de toasts: `sonner` (es el default de shadcn). Session recap del timer y feedback de errores van por aquí.
- **Toast persistente** del session recap (PLAN 1.2/5.1) = `toast(..., { duration: Infinity })` con acciones; se cierra solo al elegir energía o al `dismiss`.

### 0.8 Animaciones → CSS puro, sin Framer Motion

- El plan ya prohíbe librerías para confeti. Se extiende: **toda animación de este plan es CSS** (keyframes + transitions + Tailwind). No instalar Framer Motion.
- Confeti (1.2): burst de ~12 `<span>` absolutos generados una vez, animados con `transform: translate + rotate` y `opacity`, `will-change: transform`, se desmontan a los ~800ms vía `onAnimationEnd`. GPU-only (transform/opacity), nada de animar `top/left`.
- Tachado de completado: `text-decoration` + `opacity` transition 200ms.
- Respetar `prefers-reduced-motion`: media query que reduce a fade simple.

### 0.9 Gráficas → Recharts

- Toda gráfica del plan (energía 1.3, sparkline 5.2) usa **Recharts**. Verificar/instalar una vez.
- No mezclar con Chart.js ni D3. Una sola lib de charts.

### 0.10 Convenciones de servicio (refuerzo de PLAN decisión 14)

- **Toda lógica de scoring/energía/urgencia vive en el backend** (`*.service.ts`). El cliente nunca recalcula. Si un componente necesita "qué tan urgente", lo recibe ya computado del endpoint.
- Esto ataca M2 (lógica de scoping duplicada): un solo `taskScoping.ts` server-side, importado por todos los servicios. El cliente no tiene copia.

---

## Fase 0 — Honestidad del repo

Sin decisiones de algoritmo. Solo formato:
- `docs/STATUS.md` → tabla `| Feature | Estado (✅/🟡/🔮) | Notas |`. `🔮` = roadmap.
- No tocar código ejecutable. Solo `.md`.

---

## Fase 1 — Dashboard

### 1.1 Layout sin scroll — técnica CSS exacta

Esto es donde Claude Code más improvisa. Decisión cerrada:

- **CSS Grid con `grid-template-areas`**, no flex anidado.
  ```css
  .dashboard {
    display: grid;
    height: 100dvh;                /* dvh, no vh — respeta barra mobile */
    grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
    grid-template-rows: minmax(0, 1fr) clamp(140px, 18vh, 200px);
    grid-template-areas: "plan side" "bottom bottom";
    gap: clamp(0.75rem, 1.5vw, 1.25rem);
  }
  ```
- **Gotcha crítico**: cada hijo que scrollea internamente necesita `min-height: 0` (y `min-width: 0`). Sin esto el grid no deja que el card encoja y aparece el scroll del contenedor. Esta es LA razón por la que "no scrollea el contenedor" falla normalmente.
- Card scrollable interno: `overflow-y: auto; min-height: 0;`.
- Panel derecho: sub-grid `grid-template-rows: 55fr 45fr` (energía / advisor).
- Mobile (`< md`): cambiar `grid-template-areas` a columna única + el bottom row pasa a carrusel (`overflow-x: auto; scroll-snap-type: x mandatory`).
- **No** usar `100vh` ni alturas en `px` fijas para el contenedor. Solo `100dvh` + `clamp`/`fr`.

### 1.2 Plan de hoy interactivo

- Cada acción (completar / mover a mañana / quitar del plan / iniciar timer) = mutación con el patrón 0.2.
- **Completar**: optimistic toggle. `completedAt` se setea client-side optimista a `now`, server confirma.
- **Barra de progreso**: `width: ${done/total*100}%` con `transition: width 300ms ease`. El % de mensaje dinámico se deriva del mismo número, no query aparte.
- **Mover a mañana**: `PATCH dueDate = todayKey()+1`, `status` sin tocar. Optimistic: la tarea sale del plan de hoy (ya no es `dueDate=hoy` ni `in_today_plan` relevante para hoy). Confirmar regla: "mover a mañana" también pone `in_today_plan=false`? **Decisión: sí**, sale del compromiso de hoy.
- **Descanso recomendado**: NO calcular en cliente. Render del separador depende del flag `breakAfterItem` que viene en `energyPlan.items[i]`. El cliente solo dibuja el separador donde el flag es `true` y pinta el texto que viene del backend. Si el backend no manda texto, no se inventa genérico (se omite el separador).
- **Backend `breakAfterItem`**: en `energy.planner.ts`, al construir `items`, marcar `breakAfterItem = (curve[slot_i] - curve[slot_{i+1}]) > 15`. El texto lo arma el backend con la hora del bajón.

### 1.3 Módulo de energía — mapeo a Recharts

Decisión de componentes (el plan describe, esto lo aterriza):

- `ComposedChart` (24 puntos, eje X = hora 0-23).
  - Curva predicha → `<Bar dataKey="predicted" />` gris, barras finas.
  - Checkins de hoy → `<Scatter dataKey="actual" />` (puntos coloreados a la hora del registro). Scatter, no Line, porque son discretos y pueden ser 1-3.
  - **Hora actual** → `<ReferenceLine x={currentHour()} strokeDasharray="4 4" stroke="white" />`. Esto es lo que "más falta hoy" según el diagnóstico → prioridad.
  - Zona de pico (cronotipo) → `<ReferenceArea x1={peakStart} x2={peakEnd} />` sombreada.
  - Tooltip → `content` custom: `"{h}h — Predicho: {p} · Registrado: {a ?? '—'}"`.
- **Modo pending** (sin checkin del slot) → no renderizar chart vacío con ejes raros; render de un placeholder con CTA. Decisión: si `checkins.length === 0` ese día, mostrar la curva predicha en opacidad baja + overlay CTA. No ocultar la curva.

**Migración triple (PLAN decisión 8) — gotcha de Postgres:**
- `ALTER TYPE ... ADD VALUE` (para `planning` en Fase 4 y para el enum de slot aquí) **no puede ejecutarse dentro de una transacción** y el nuevo valor **no se puede usar en la misma transacción** donde se crea.
- Drizzle corre migraciones en transacción por defecto → **separar el `ADD VALUE` en su propia migración SQL crudo** que corra antes de la migración Drizzle que lo usa. Orden:
  1. Migración SQL: `ALTER TYPE ... ADD VALUE 'morning'` etc. (cada `ADD VALUE` aislado).
  2. Migración Drizzle: dropear unique viejo, agregar columna `slot`, nuevo unique `(userId,date,slot)`, columna `prediction_accuracy`.
- El nuevo unique `(userId, date, slot)` requiere que filas existentes tengan `slot`. **Backfill** en la misma migración: asignar slot a checkins viejos según la hora de `createdAt` (`currentSlot` de esa hora) antes de aplicar el `NOT NULL` + unique.

### 1.4 "Kino te conoce" / 7 días — la query de correlación

- **No usar Pearson ni regresión.** Es ruido para el volumen de datos. Decisión: **ratio simple**.
  ```sql
  -- por día en últimos N días:
  --   completados_con_checkin  = sum(completados) WHERE día tuvo ≥1 checkin
  --   completados_sin_checkin  = sum(completados) WHERE día sin checkin
  -- factor = avg(completados en días con checkin) / avg(completados en días sin checkin)
  ```
  Texto: `"Los días que registraste energía completaste {factor}× más tareas."` redondeado a 1 decimal.
- **Guard duro**: solo si `días_con_historial >= 14` (definido como días con ≥1 tarea completada O ≥1 checkin). Si no, texto de aprendizaje fijo del plan. Cero valores hardcodeados de correlación.
- Query vive en el endpoint del dashboard (un solo round-trip), no en llamada aparte. Es `correlationFactor` dentro del payload del dashboard.
- "Kino te conoce" frase dinámica: se arma en backend con `currentHour`, `peakStart`, `alpha`. El cliente solo muestra. (Refuerza 0.10.)

### 1.5 EnergyAdvisorBanner

- Componente puro presentacional + hook `useEnergyAdvisor()` que envuelve la query de `getTodayAdvisor`.
- Props: `{ message, icon, action?: { label, onClick } }`. Una línea.
- Se monta en dashboard, `/systems/[id]`, `/tasks`. Mismo componente, distinta posición. **Bloqueante para Fase 2** (ya en PLAN).
- En `TaskActionView`: la columna activa (High/Med/Low) se resalta con `ring-2`. Qué columna está activa lo dice el backend (banda de energía actual), no se calcula en cliente.

---

## Fase 2 — `/tasks` Smart Daily Focus

### 2.1 Algoritmo del plan sugerido — fórmula determinista

El plan describe el orden; esto lo vuelve una función pura y determinista en `insights.service.getSuggestedTasks` (backend). Sin "criterio en el momento":

```
score(task) =
    (isOverdue ? 1000 : 0)                       // vencidas mandan
  + priorityWeight                                // crit 400, high 300, med 200, low 100
  + dueSoonBonus                                  // due en ≤2d: +150; ≤7d: +75; resto 0
  + energyMatchBonus                              // task.energy == bandaActual: +120
                                                  // adyacente (med↔high, med↔low): +60; opuesta: 0
  + ageBonus                                      // min(daysSinceCreated, 14) * 4  (cap 56)

banda de energía actual:
  - si hay checkin del slot actual → usar currentLevel
  - si no → usar projectedCurve[currentHour] (PLAN 2.1.1)
```

- Orden: `score` desc, desempate por `dueDate` asc, luego `createdAt` asc (estable).
- Filtro de estatus: hoy `['today','tomorrow','week']` → tras Fase 4 cambia a `['action']` (PLAN). Marcar con un `// TODO Fase 4` exacto en el código.
- Endpoint devuelve **hasta 10**; UI muestra 3-7. Excluir `done` y `idea` (idea no entra al plan del día).
- **Cero lógica de scoring en el componente React.** Llega ordenado.

### 2.1.b Caché "1× por día" del plan sugerido

- En cliente: `useRef<{ dateKey: string; data: Task[] } | null>`. Al montar, si `ref.current?.dateKey === todayKey()` → usar caché, no refetch. Si distinto o null → fetch y guardar.
- `[Regenerar sugerencias]` → fuerza `queryClient.invalidateQueries(qk.suggestedTasks(today))` + actualiza el ref.
- Al completar una sugerida → subir la siguiente de las 10 ya cargadas **en memoria**, sin llamar endpoint (PLAN 2.1).
- No `sessionStorage`/`localStorage` (artifacts/PWA: usar React state; refresh re-genera, es aceptable).

### 2.2 Filtros en URL — serialización

- **Encoding**: un query param por filtro, multi-valor como CSV.
  `?status=action,planning&system=uuidA,uuidB&priority=high&group=system&sort=priority`
- Helpers en `lib/taskFilters.ts`: `parseFiltersFromParams(searchParams): TaskFilters` y `filtersToParams(filters): URLSearchParams`. Un solo lugar.
- **El filtrado/agrupado/orden es client-side** (la data ya está cargada para el sistema/usuario). Mapas de comparadores y agrupadores:
  ```ts
  const SORTERS: Record<SortKey, (a,b)=>number> = { priority, dueDate, energy, created };
  const GROUPERS: Record<GroupKey, (t)=>string> = { system, status, priority, energy };
  ```
- **Virtualización**: NO por ahora. Solo si una vista supera ~200 filas de forma rutinaria → entonces `@tanstack/react-virtual`. Decisión: no instalar todavía; render con `map`. (Evita complejidad prematura.)
- Toggle lista/grid/board: el estado del toggle también va en URL (`?view=list`) para que sea linkeable.
- Chips removibles: derivados de `TaskFilters`, cada uno hace `replace` de la URL quitando ese valor.

---

## Fase 3 — Formulario y tipos

### 3.1 CreateTaskDialog progresivo

- `react-hook-form` (0.4), **un form**, `step: 1|2|3` en `useState`.
- Avance: `const ok = await form.trigger(STEP_FIELDS[step]); if (ok) setStep(s=>s+1)`.
- `STEP_FIELDS` = constante: paso1 `['title','systemId']`, paso2 `['energy','priority','type','startDate','dueDate','estimatedDuration']`, paso3 `['notes','subtasks','reminders','contextTags']`.
- "Guardar" disponible desde paso 1 → submit con lo que haya; el resto usa defaults.
- Memoria de paso (PLAN decisión 12): `useState` local; al cerrar, reset. Regla apertura: si viene `systemId` por prop (contexto explícito) → siempre paso 1. Si viene de QuickAdd global → restaurar último `step`.
- Tres dots = `step` actual. `Esc` descarta (componente Dialog de shadcn ya lo hace).

### 3.2 EstimatedTime pill selector

- `ToggleGroup` (shadcn) `type="single"`, valores en **minutos** (15,30,60,120). "3h+" → abre `Popover` con 180/240/300/custom. "—" → `null`.
- Controlado por RHF (`Controller`). Schema sigue `number | null` en minutos. Sin cambio de columna.

### 3.3 task_type — config map (patrón clave)

**No** dispersar `if (type === ...)`. **Un solo objeto** fuente de verdad, consumido por form, card y validación:

```ts
export const TASK_TYPE_CONFIG: Record<TaskType, {
  icon: LucideIcon;
  label: string;
  defaultStatus?: TaskStatus;        // idea → 'backlog'
  forceStatus?: boolean;             // idea: true
  requiredFields: (keyof Task)[];    // event:['startDate'], reminder:['dueDate']
  hiddenInStep2: (keyof Task)[];     // idea: fechas; reminder: energy/priority
  showOverdueStyling: boolean;       // idea: false
  createsReminder?: boolean;         // reminder: true
}> = { task: {...}, idea: {...}, event: {...}, reminder: {...}, habit: {...} };
```

- Validación por tipo → **discriminated union de Zod** (`z.discriminatedUnion('type', [...])`) en el schema compartido. Esto cubre "event sin startDate = error" sin ifs.
- `habit`: solo icono 🔁 + badge. **Sin streak** (PLAN). No tocar lógica de recurrencia.
- Backend: cambios en `tasks.service.ts` leen del mismo config (compartido). Sin columnas nuevas.

---

## Fase 4 — Funnel

### 4.1 / 4.2 Microcopy y empty states

- Textos exactos ya en PLAN → constantes en `lib/copy/funnel.ts`. Sin lógica.

### 4.3 Planning DnD — @dnd-kit exacto

- `@dnd-kit/core` (ya en proyecto, PLAN). **No** instalar otra lib de DnD.
- Estructura: `<DndContext sensors={[Pointer, Keyboard]} collisionDetection={closestCenter}>`.
  - Panel izquierdo: `useDraggable` por chip (tareas sin `startDate`).
  - Días: `useDroppable` por columna (id = `YYYY-MM-DD`).
  - `onDragEnd`: `over.id` es el día → `PATCH startDate = over.id` (optimistic, patrón 0.2). La tarea sale del panel izquierdo en el cache optimista.
- A11y / sin-mouse: `KeyboardSensor` + el fallback de click → `[Hoy][Mañana][Esta semana][Elegir día]` (PLAN). Ambos caminos llaman la **misma** mutación.
- **Mobile**: sin DndContext (PLAN). Click chip → bottom sheet con los 4 botones → misma mutación. El calendario se comprime a 3 días con scroll-x.
- `DragOverlay` para el chip mientras se arrastra (evita el bug de layout shift de dnd-kit).

### 4.4 Backlog staging

- "→ Esta semana": `startDate = lunes de la semana actual` (helper `mondayOfThisWeek(tz)` en `dateKeys.ts`). Optimistic.
- Agrupar por sistema: `GROUPERS.system` (reusar el de 2.2, no duplicar).
- Badge de volumen: `if (backlog.length > 10)` → banner con link a Planning. Umbral fijo = 10.

### 4.5 Validaciones de coherencia

- **Todas** como `.superRefine()` en el schema Zod compartido (cliente + backend):
  - `dueDate < startDate` → error (bloquea).
  - `type='event'` sin `startDate` → error.
  - `type='reminder'` sin `dueDate` → error.
- `dueDate=hoy` con `startDate>hoy` → **warning, no error**. El warning NO va en el schema (Zod es pass/fail). Va como check separado `getCoherenceWarnings(task): Warning[]` que el TaskDetailSheet pinta. No auto-corrige (PLAN decisión 5).

---

## Fase 5 — Timer

### 5.1 Motor del Pomodoro — decisiones duras

- **Fuente de verdad = timestamps, no contador decreciente.** Guardar `startedAt: number` + `durationMs`. El tiempo restante se computa `durationMs - (Date.now() - startedAt)` en cada tick. **Razón**: `setInterval` se ralentiza/pausa con la pestaña en background → un contador `--` derivaría minutos. Con timestamps, al volver a foco el número es correcto.
- Tick visual: `setInterval(1000)` solo para re-render del display. El cálculo real es por timestamp. (No usar el interval como verdad.)
- **Estado del timer = `useReducer` (máquina de estados)**, no varios `useState` sueltos:
  ```
  idle → working → (auto al llegar a 0) breakRunning → idle
                 → (stop manual) → recap → idle
  modos: pomodoro | estimated | free
  acciones: START, TICK, EXPIRE, STOP, COMPLETE_TASK, START_BREAK, RESET
  ```
- **Cross-route**: el estado vive en `FocusTimerProvider` (Context) en el root layout. El `FocusTimerWidget` lo consume desde cualquier ruta. Mobile: banner sobre BottomNav (PLAN).
- **Auto-stop a 0**: `EXPIRE` dispara `playTimerChime()` + cambia widget a "tiempo agotado". Pomodoro: además auto-arranca `breakRunning` (PLAN). Push notification = roadmap, NO implementar.

**`playTimerChime()` — Web Audio API, tono sintetizado (PLAN decisión 3/13):**
```ts
// sin archivos de audio, funciona offline
function playTimerChime() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const notes = [660, 880]; // dos notas ascendentes, sine
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = ctx.currentTime + i * 0.18;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.02);   // ataque corto
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35); // release
    osc.connect(gain).connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.4);
  });
}
```
- **Gotcha**: `AudioContext` requiere gesto del usuario para iniciarse. Como el timer lo arranca el usuario (botón "Enfocarme"), crear/resume el `AudioContext` en ese click y reusarlo. No crear uno nuevo en cada chime si se puede reusar el del provider.

**Session recap (PLAN 5.1):**
- Toast `sonner` persistente (`duration: Infinity`) con 3 botones de energía.
- La respuesta → **upsert** del checkin del slot activo (`ON CONFLICT (userId, date, slot) DO UPDATE SET currentLevel=...`). No crea fila nueva si ya hay checkin del slot (PLAN decisión 8). Alimenta `calibrateLearnedCurve`.
- `timeLog` se inserta al `STOP`/`COMPLETE` con `durationSeconds` reales + `energyLevel` del recap.

### 5.2 Tiempo acumulado

- Suma de `timeLogs` por tarea → query agregada (`SUM(durationSeconds)`, `COUNT(*)`). Formato `Xh Ymin · N sesiones` con un helper `formatDuration`.
- Sparkline de `systemHealth` → Recharts `<LineChart>` mini sin ejes (`<Line dot={false}>`, sin `XAxis`/`YAxis` visibles). No otra lib.
- `getTopPattern` (PLAN nota): hoy es alias de `getTodayAdvisor`. **Implementar query real**: cruzar `timeLogs` (hora del día) + `energyCheckins` para detectar franja de mayor productividad. Decisión de algoritmo: agrupar `timeLogs` por slot, calcular `SUM(duration)` y `COUNT(completed)` por slot, el slot con mayor `completed/hora` es el "pico real". Comparar contra cronotipo declarado.

---

## Fase 6 — system_type

### 6.1 Config map (mismo patrón que 3.3)

**Un solo objeto** fuente de verdad. No ifs dispersos:

```ts
export const SYSTEM_TYPE_CONFIG: Record<SystemType, {
  defaultTaskEnergy: 'low'|'medium'|'high';      // work:high, health:low, creative:medium, learning:medium
  schedulingPreference: 'lowSlot'|'peak'|'highMedium'; // health:lowSlot, creative:peak, work:highMedium
  advisorTemplate: string;                        // con {nombre} {n}
  defaultIcon: LucideIcon;
}> = { work:{...}, health:{...}, creative:{...}, learning:{...} };
```

- `energy.planner.ts` lee `schedulingPreference` para colocar tareas (no hardcodear por nombre de sistema).
- Advisor type-aware: función `renderAdvisor(template, { nombre, n })` con interpolación simple (`.replace`). Templates exactos en PLAN 6.1.
- `getSystemHealthIndicator(systemId)`: query usando `systemHealth` + `expectedFrequency`. `daily` y `systemHealth.date` >2 días → `stale`. Badge en `SystemTreeItem`.
- `trigger_context` y `description` → texto colapsable en `SystemDetailHeader`. Sin columnas nuevas.
- Icono por defecto: si `system.icon == null` → `SYSTEM_TYPE_CONFIG[type].defaultIcon`. No persistir, resolver en render.

---

## Resumen de "verificar una vez" (no preguntar — verificar contra el repo y proceder)

Estas 4 cosas dependen del estado real del `package.json`/schema. Verificar y seguir el default indicado:

1. **`@tanstack/react-query`** instalado → si no, instalarlo. Es la base de todo (0.1).
2. **`react-hook-form` + `recharts`** instalados → si no, instalarlos (0.4, 0.9).
3. **`date-fns` / `date-fns-tz`** → usar el que esté; si ninguno, `date-fns + date-fns-tz` (0.6).
4. **Columna de timezone del usuario** en profile → si existe, usarla en `dateKeys`; si no, fallback `America/Santo_Domingo` y dejar `// TODO: tz por usuario` (0.6).

Todo lo demás está decidido aquí o en PLAN.md. Si Claude Code encuentra una decisión de implementación no cubierta, el default es: **el patrón global de la sección 0 manda.**
