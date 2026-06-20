# PLAN 02 — Inteligencia visible en una sola superficie

> Origen: Sección E item 7 (A7/B8) + Sección F item 2. Esfuerzo M. ROI ★★★★★.
> Idea central: el backend ya calcula inteligencia (energía, advisor, insights, sugerencias)
> pero **`insights.service` tiene 0 consumidores `.tsx`**. Exponerla en **una sola superficie**
> ("Hoy / Coach"), no en N badges por toda la app (evitar bloatware, A7/B8).

## Estado hoy

- `src/features/insights/insights.service.ts`: `getUserContext`, `getSuggestedTasks`
  (scoring real: prioridad + vencida + energía + edad), `getEnergyDistribution`,
  `classifyTask`, `getStaleSystems`, `getTopPattern` (advisor del día).
- `src/features/insights/insights.routes.ts`: endpoints para distribution / suggested / stale.
- `src/features/energy/`: `energy.advisor.ts`, `energy.planner.ts` (curva de energía), con tests.
- Dashboard ya tiene tarjetas sueltas: `AdvisorCard`, `EnergyTodayCard`, `WeeklyTrendsCard`,
  `LearningInsightCard`, `TodayPlanCard`, `FocusNowCard`. **Pero** `insights.service`
  (suggested/distribution/stale) no se consume desde ningún `.tsx` — viven solo en MCP/API.
- Hooks de datos: `energy.hooks.ts` existe; **no hay** `insights.hooks.ts` cliente.

## Decisión de diseño (A7/B8 Sol3)

Una sola superficie consumidora: una vista/panel **"Hoy"** (o "Coach") que reúne:
sugerencia del día, pattern del advisor, distribución de energía y sistemas stale.
No incrustar estos datos en cada vista de sistema.

---

## Sprint 1 — Capa de datos cliente (hooks)

### Ticket 1.1 — `insights.hooks.ts`
**Estado hoy:** no existe hook cliente para insights.
**Pasos:**
1. Crear `src/features/insights/insights.hooks.ts`.
2. Añadir `useSuggestedTasks(limit)`, `useEnergyDistribution(days)`, `useStaleSystems()`
   que pegan a los endpoints de `insights.routes.ts` (mirar cómo `energy.hooks.ts` arma sus queries: claves, `queryFn`, `staleTime`).
3. Definir las query keys en un objeto local (`insightsKeys`) siguiendo el patrón de `tasks.keys.ts`.
**Hecho cuando:** un componente de prueba puede leer `useSuggestedTasks()` y ver datos reales.

### Ticket 1.2 — Verificar/añadir el endpoint de advisor
**Estado hoy:** `getTopPattern`/advisor existe en service; confirmar que hay ruta o usar la de energía.
**Pasos:**
1. Revisar `energy.routes.ts`/`insights.routes.ts` para ver si el advisor del día ya se expone.
2. Si no, añadir `GET` que devuelva `getTopPattern(userId)`.
3. Hook `useTopPattern()`.
**Hecho cuando:** el advisor del día es consultable desde cliente.

---

## Sprint 2 — La superficie "Hoy / Coach"

### Ticket 2.1 — Esqueleto de la vista
**Estado hoy:** el dashboard ya existe pero dispersa tarjetas.
**Pasos:**
1. Decidir hogar: o una ruta nueva `/(app)/today` o consolidar dentro del dashboard.
   Recomendado: una sección "Coach" dentro del dashboard para no crear navegación nueva.
2. Crear `src/features/insights/CoachPanel.tsx` (componente contenedor, colapsable).
3. Renderizar 4 slots vacíos: Sugerencia, Pattern, Energía, Stale.
**Hecho cuando:** el panel aparece colapsable, sin datos aún.

### Ticket 2.2 — Slot "Sugerencia del día"
**Pasos:**
1. Consumir `useSuggestedTasks(1)` (o top 3).
2. Mostrar título + el campo `why` que ya devuelve el service ("vence mañana, prioridad alta")
   y la `energyBand`.
3. Acción de 1 toque: "Hacer ahora" → mueve a `today` (reusar `useMoveTask`/`bulkMoveTasks`).
**Hecho cuando:** la sugerencia real aparece con su porqué y un botón que la acciona.

### Ticket 2.3 — Slot "Pattern del advisor"
**Pasos:**
1. Consumir `useTopPattern()`.
2. Mostrar `label` + `message` + `actionLabel` (campos que ya devuelve `getUserContext.topPattern`).
3. Encuadre **amable**, no alarma (B2/B8): nunca rojo acumulativo.
**Hecho cuando:** el pattern del día se ve con lenguaje de acción, no de culpa.

### Ticket 2.4 — Slot "Distribución de energía"
**Pasos:**
1. Consumir `useEnergyDistribution(7)`.
2. Reutilizar `EnergyChart`/`energyDisplay.ts` del dashboard si encajan; si no, barra simple por sistema con `percentage`.
**Hecho cuando:** se ve en qué sistemas gastaste energía esta semana.

### Ticket 2.5 — Slot "Sistemas dormidos"
**Pasos:**
1. Consumir `useStaleSystems()`.
2. Listar sistemas con `daysSinceLastTask`, con CTA suave ("¿retomar?" → navega al sistema).
**Hecho cuando:** los sistemas inactivos se muestran sin tono punitivo.

---

## Sprint 3 — Pulido y guardia anti-ruido

### Ticket 3.1 — Estados vacíos y carga
**Pasos:**
1. Skeletons por slot (reusar el componente de skeletons renombrado recientemente).
2. Empty states honestos ("aún no hay datos suficientes") sin inventar.
**Hecho cuando:** sin datos, el panel no rompe ni miente.

### Ticket 3.2 — Una sola superficie (no metástasis)
**Pasos:**
1. Auditar que no se estén duplicando estos insights en otras vistas.
2. Documentar la regla en el plan: insights viven aquí; otras vistas no los repiten.
**Hecho cuando:** queda claro que "Coach" es el único hogar de la inteligencia.

## Riesgos
- Confundir profundidad con desorden — mantener colapsable y bajo demanda (A7 Sol1).
- Sugerencias mal calibradas pierden credibilidad — empezar conservador y siempre con `why` visible.
