# PLAN 04 — Calendario global + time-blocking asistido por energía

> Origen: Sección A9 / B9 + Sección F item 3. Esfuerzo M–L. ROI ★★★★.
> **El diferenciador más fuerte del documento**: fusiona los dos cerebros (tareas + energía)
> en una sola feature visible. Hay que construir base nueva (vista global) primero.

## Estado hoy

- Fechas ya son `timestamptz` con hora opcional: `tasks.dueDate` y `tasks.startDate`
  (`schema.ts:635/638`, `mode:'string'`), con `hasDueTime` por convención (ver `project-date-convention`).
- Existe `TaskCalendarView.tsx` y `TaskCalendarMobileView.tsx` **por sistema**, y `MultiDayTaskBar.tsx`.
- **No hay calendario global** (todas las tareas con fecha en una vista). F lo confirma.
- `energy.planner.ts` calcula `projectedCurve` (curva de energía por hora); `energy.advisor.ts`
  y `getSuggestedTasks` ya puntúan match de energía. Esa lógica existe; falta la superficie.
- `date-fns` ya está en deps.

## Estrategia
Fase 1: **vista de calendario global** (semana/día) que lee todas las tareas con fecha.
Fase 2: **arrastrar tarea a un bloque horario** (time-blocking manual).
Fase 3: **sugerencia por energía** (Kino propone la hora según la curva). *Nadie más tiene esto.*
Empezar conservador y explicable (riesgo: sugerencias mal calibradas pierden credibilidad).

---

## Sprint 1 — Vista de calendario global (lectura)

### Ticket 1.1 — Query global de tareas con fecha
**Estado hoy:** las queries de calendario son por sistema.
**Pasos:**
1. En `tasks.service.ts`, añadir `getScheduledTasks(userId, fromISO, toISO)` que devuelve tareas
   con `startDate` o `dueDate` dentro del rango, todos los sistemas, `deletedAt IS NULL`.
2. Ruta `GET /api/tasks/calendar?from&to` en `tasks.routes.ts`.
3. Hook `useCalendarTasks(from, to)`.
**Hecho cuando:** un componente recibe todas las tareas fechadas de un rango.

### Ticket 1.2 — Layout semana/día (solo render)
**Estado hoy:** existe vista por sistema reutilizable como referencia.
**Pasos:**
1. Crear `src/features/calendar/` (feature nueva) con `GlobalCalendarView.tsx`.
2. Reutilizar lo que se pueda de `TaskCalendarView`/`MultiDayTaskBar`; si difiere mucho, construir grid semana (7 columnas) con franjas horarias.
3. Pintar tareas con hora en su franja; tareas sin hora en una banda "todo el día".
**Hecho cuando:** se ve la semana con las tareas en su lugar (sin interacción aún).

### Ticket 1.3 — Navegación y entrada
**Pasos:**
1. Botones anterior/siguiente semana, "hoy", toggle día/semana.
2. Entry point: ítem en command palette y/o nav ("Calendario", G C).
**Hecho cuando:** se navega entre semanas y se llega desde el menú.

### Ticket 1.4 — Versión móvil
**Pasos:**
1. Vista día (scroll vertical de horas) siguiendo convención `*MobileView` y sin DnD en touch (ver `project-mobile`).
**Hecho cuando:** en móvil se ve el día con sus bloques.

---

## Sprint 2 — Time-blocking manual (drag)

### Ticket 2.1 — Arrastrar tarea a una franja
**Estado hoy:** hay DnD de planificación (`src/features/tasks/dnd`).
**Pasos:**
1. Reutilizar el sistema DnD existente para soltar una tarea en una franja horaria.
2. Al soltar: set `startDate` con esa fecha+hora (y `hasDueTime`/hora según convención) vía `updateTask` optimista.
**Hecho cuando:** soltar una tarea en las 3pm le pone esa hora y persiste.

### Ticket 2.2 — Redimensionar = duración
**Pasos:**
1. Permitir estirar el bloque para ajustar `estimatedTime`.
2. Guardar como `HH:MM` (columna `time`).
**Hecho cuando:** el alto del bloque refleja y edita la duración estimada.

### Ticket 2.3 — Panel lateral "sin programar"
**Pasos:**
1. Columna con tareas activas sin hora, arrastrables al calendario.
**Hecho cuando:** se puede vaciar el backlog del día hacia bloques.

---

## Sprint 3 — Time-blocking asistido por energía (el diferenciador)

### Ticket 3.1 — Overlay de la curva de energía
**Estado hoy:** `energy.planner.ts` ya produce `projectedCurve` por hora.
**Pasos:**
1. Pintar la curva de energía de fondo en la vista día (zonas alta/media/baja por hora).
**Hecho cuando:** el usuario ve sus horas de alta/baja energía sobre el calendario.

### Ticket 3.2 — Sugerir hora por match de energía
**Pasos:**
1. Reutilizar el scoring de energía de `getSuggestedTasks`/`scoreTask` (energyBand vs `task.energyLevel`).
2. Para una tarea sin hora, proponer la mejor franja libre cuya banda de energía coincida.
3. Mostrarlo como **propuesta** ("Kino sugiere 9–10am"), aceptable con un click. Nunca auto-aplicar.
**Hecho cuando:** Kino propone una hora explicable y el usuario la acepta/rechaza.

## Riesgos
- Es la pieza más grande del rumbo: hacer Fase 1 sólida antes de Fase 2/3.
- Sugerencias de energía mal calibradas → empezar conservador, siempre explicable, siempre opcional.
- Convención de tz del usuario (no off-by-one) — seguir `project-date-convention` estrictamente.

## Nota de futuro (no en este plan)
La vista global es prerrequisito de integraciones externas: feed iCal de salida (A9 Sol2, barato)
y, mucho más adelante, sync Google (L, anti-objetivo si se hace antes de madurar la vista).
