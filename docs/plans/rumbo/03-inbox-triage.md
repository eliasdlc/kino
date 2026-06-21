# PLAN 03 — Inbox de triage + replanificación amable de vencidas

> Origen: Sección B5 (abismo captura→organización) + B2 (bola de nieve de vencidas) + F item 4.
> Esfuerzo M. ROI ★★★★. Es el eje **anti-estrés** y de organización masiva.

## Estado hoy

- Captura buena (`GlobalQuickAddDialog`), pero el Inbox **no está optimizado para procesar en masa**.
- Bulk en backend ya existe: `bulkMoveTasks`, `bulkUpdateTasks`, `bulkCreateTasks`
  (`tasks.service.ts:517/531/780`) y en MCP (`bulk_move_tasks`, `bulk_update_tasks`).
- Navegación por teclado j/k/enter existe: `useTaskKeyboardNavigation.ts` (con tests).
- Status se deriva de fecha; hay rollover/reconciliación (`reconcileTaskStatuses`, `ensureTodayPlanRolled`).
- **No hay** UI de selección múltiple ni acción masiva de "posponer vencidas".

## Dos features que comparten infraestructura
A) **Triage mode**: multi-select + acciones en lote en el Inbox.
B) **Replanificación amable**: posponer todo lo vencido a hoy/mañana/semana de un toque.
Ambas usan los bulk endpoints existentes + un sistema de **undo** robusto.

---

## Sprint 1 — Selección múltiple (la base)

### Ticket 1.1 — Estado de selección
**Estado hoy:** las listas de tareas no tienen concepto de "seleccionadas".
**Pasos:**
1. Crear un store/local state de `selectedTaskIds: Set<string>` (Zustand si debe sobrevivir navegación; `useState` si es por vista). Recomendado local a la vista de Inbox.
2. Añadir toggle de selección por tarea (checkbox que aparece en hover/`md:opacity-0` como las acciones existentes, ver convención mobile).
**Hecho cuando:** se pueden marcar/desmarcar varias tareas y el conteo se ve.

### Ticket 1.2 — Selección por teclado
**Estado hoy:** `useTaskKeyboardNavigation` ya da j/k/enter.
**Pasos:**
1. Extender el hook (o envolver) para `x` = toggle selección de la fila enfocada, `shift+j/k` = rango.
2. `esc` = limpiar selección.
**Hecho cuando:** se puede seleccionar sin ratón.

### Ticket 1.3 — Barra de acciones en lote
**Pasos:**
1. Cuando hay ≥1 seleccionada, mostrar una barra inferior con: Mover a sistema, Fechar (hoy/mañana/semana), Prioridad, Etiqueta, Completar, Eliminar.
2. Cada acción llama al bulk hook correspondiente.
**Hecho cuando:** la barra aparece con selección y desaparece al limpiar.

---

## Sprint 2 — Acciones en lote conectadas + undo

### Ticket 2.1 — Hooks de bulk en cliente
**Estado hoy:** los bulk existen en service/MCP pero confirmar hooks cliente.
**Pasos:**
1. En `tasks.hooks.ts`, añadir `useBulkMove`, `useBulkUpdate` que pegan a las rutas de `tasks.routes.ts` (verificar que existan; si falta la ruta, añadirla espejando el service).
2. Optimistic update sobre las listas afectadas (mirar el patrón `onMutate` ya presente en `tasks.hooks.ts:76`).
**Hecho cuando:** una acción en lote se refleja al instante.

### Ticket 2.2 — Undo de acción masiva
**Estado hoy:** sin undo; un bulk erróneo asusta (riesgo declarado en B5).
**Pasos:**
1. Tras un bulk, mostrar un toast "Movidas N tareas — Deshacer".
2. Guardar el estado previo (ids + valores anteriores) y, en "Deshacer", aplicar el bulk inverso.
3. Ventana de undo ~5–8s.
**Hecho cuando:** deshacer revierte exactamente el lote.

### Ticket 2.3 — "Vaciar inbox" en cascada (opcional, modo Superhuman)
**Pasos:**
1. Modo alternativo: una tarea a la vez, teclas para clasificar (sistema/fecha), siguiente.
2. Reusar `useTaskKeyboardNavigation` + las acciones por-tarea.
**Hecho cuando:** se puede procesar el inbox tarea por tarea solo con teclado.

---

## Sprint 3 — Replanificación amable de vencidas

### Ticket 3.1 — Detectar y agrupar lo vencido
**Estado hoy:** status se deriva de fecha; hay reconciliación pero no un "grupo vencidas" accionable.
**Pasos:**
1. Query/selector de tareas con `dueDate < hoy` y status activo (reusar `dayToLocalISO` y la convención de tz — ver `project-date-convention`).
2. Mostrarlas en un bloque "Pendientes de antes" con encuadre amable (B2 Sol2), **sin badge rojo acumulativo**.
**Hecho cuando:** lo vencido se agrupa con lenguaje neutro.

### Ticket 3.2 — Posponer en bloque (un toque)
**Pasos:**
1. Botones "Mover todo a hoy / mañana / esta semana" sobre el grupo de vencidas.
2. Usa `bulkUpdateTasks` (set `dueDate`/`startDate`) + el undo del Ticket 2.2.
3. **Siempre proponer, nunca auto-mover** sin click (regla de oro del advisor, B2 riesgo).
**Hecho cuando:** reprogramar 20 vencidas es un click y reversible.

### Ticket 3.3 — (Futuro/conecta con Plan 02) sugerencia por energía
**Pasos:**
1. Marcar como follow-up: usar el advisor para sugerir a qué día reagrupar según carga.
2. No implementar aquí; dejar el hook visual listo (un "sugerido por Kino" deshabilitado).
**Hecho cuando:** queda el gancho documentado, sin lógica aún.

## Riesgos
- Sin undo, el bulk asusta → Ticket 2.2 es obligatorio antes de soltar bulk a usuarios.
- Auto-mover fechas sin consentimiento erosiona confianza → todo es propuesto.
