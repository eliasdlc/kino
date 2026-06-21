# PLAN 10 — Vistas intercambiables por sistema

> Origen: Sección E item 5 (B7). Esfuerzo M. ROI ★★.
> Idea central: hoy la vista está **fijada por `system_type`**. Permitir que un mismo sistema se
> vea como **lista / board / calendario** según prefiera el usuario. Anti-rigidez metodológica.

## Estado hoy

- 5 vistas por `system_type` (academic, entrepreneurial, project/kanban, custom, detail) —
  ver `src/shared/lib/system-types.ts` y las vistas en `src/features/systems`.
- Las vistas ya están **desacopladas por tipo** (existen `TaskPlanningView`, `TaskKanbanView`,
  `TaskCalendarView`, `AllTasksList`...). El acoplamiento es que el **tipo elige la vista**, no el usuario.
- `systems` tiene `metadata jsonb` (migración 0004) — buen sitio para guardar la preferencia de vista sin migración nueva.

## Estrategia
No multiplicar N vistas × N tipos. Permitir elegir, **dentro de un sistema**, entre las vistas que
apliquen a sus datos, con un default razonable por tipo. Guardar la elección en `systems.metadata`.

---

## Sprint 1 — Selector de vista (sin persistir)

### Ticket 1.1 — Inventario de vistas reutilizables
**Estado hoy:** cada tipo monta su vista fija.
**Pasos:**
1. Listar qué vistas existen y a qué datos aplican (board solo tiene sentido con `boardStatus`; calendario solo con tareas fechadas).
2. Definir un mapa `availableViews(systemType)` → `('list'|'board'|'calendar')[]`.
**Hecho cuando:** existe la fuente de verdad de qué vistas aplican a cada sistema.

### Ticket 1.2 — Toggle de vista en el toolbar del sistema
**Estado hoy:** `FolderViewToolbar.tsx`/toolbars existen.
**Pasos:**
1. Añadir un control segmentado (Lista / Board / Calendario) que muestre solo las vistas válidas.
2. Estado local `currentView`; renderizar la vista elegida.
**Hecho cuando:** dentro de un sistema se puede cambiar entre las vistas válidas (sin recordar la elección aún).

---

## Sprint 2 — Persistir la preferencia

### Ticket 2.1 — Guardar `preferredView` en `systems.metadata`
**Estado hoy:** `metadata jsonb` existe pero no guarda esto.
**Pasos:**
1. Extender `updateSystem` para aceptar `metadata.preferredView`.
2. Al cambiar de vista, persistir (optimista).
**Hecho cuando:** recargar el sistema mantiene la última vista elegida.

### Ticket 2.2 — Default por tipo
**Pasos:**
1. Si no hay `preferredView`, usar el default del tipo (mantiene el comportamiento actual).
**Hecho cuando:** sistemas sin preferencia se ven exactamente como hoy.

---

## Sprint 3 — Coherencia de datos por vista

### Ticket 3.1 — Estados vacíos por vista
**Pasos:**
1. Calendario sin tareas fechadas / board sin columnas → empty states honestos que guíen ("este sistema no usa board" o "ninguna tarea tiene fecha").
**Hecho cuando:** elegir una vista poco aplicable no muestra una pantalla rota, sino una guía.

### Ticket 3.2 — No romper las vistas especializadas
**Pasos:**
1. Verificar que las vistas académicas/emprendimiento (que tienen UI propia más allá de lista/board) sigan siendo el default y no se pierdan al introducir el toggle.
**Hecho cuando:** las vistas especializadas conviven con el toggle sin regresión.

## Riesgos
- Matriz N vistas × N tipos = mantenimiento. Mitigar con `availableViews` (solo combinaciones que aplican).
- No toda vista aplica a todo dato (board necesita `boardStatus`) — el selector debe ocultarlas, no fallar.
