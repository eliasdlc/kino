# PLAN 09 — Subtareas / epics pulidas

> Origen: Sección E item 1 (B6 Sol1). Esfuerzo M. ROI ★★★.
> Idea central: la jerarquía existe a nivel **datos** (`parentTaskId`) pero está mal expuesta.
> Pulir lo que ya hay: subtareas con fecha/energía propias, completar madre sin borrar hijas,
> progreso = % de hijas, y mostrarlo bien en todas las vistas. **No** dependencias (eso es Plan 14).
> **No** sub-subtareas (jerarquía infinita = trampa de Notion, A3) — limitar a 1–2 niveles.

## Estado hoy

- Schema: `tasks.parentTaskId` (self-ref, `onDelete: 'cascade'`) — subtasks y epics comparten tabla,
  así que **ya tienen** columnas `dueDate`, `startDate`, `energyLevel`, `priority`, etc.
- `getSubtasks(taskId, userId)` en `tasks.service.ts:240`; hook `useSubtasks`.
- `SubtaskList.tsx`: muestra **solo** título + toggle (completar) + borrar. No fecha, no energía, no progreso.
- Completar usa `toggleTask` (soft, set `completedAt`); borrar es soft-delete. La cascade es a nivel FK (borrado duro), pero el flujo de UI usa soft-delete, así que **completar la madre NO borra hijas** hoy — bien.
- `idx_tasks_parent` ya existe para queries por padre.

## Estrategia
Subtareas son tareas de primera clase con UI reducida. Enriquecer `SubtaskList` y la madre,
sin tocar el modelo de datos (ya alcanza).

---

## Sprint 1 — Subtareas con atributos propios

### Ticket 1.1 — Mostrar fecha/energía de la subtarea
**Estado hoy:** `SubtaskList.tsx` solo pinta el título.
**Pasos:**
1. En cada fila de subtarea, mostrar (si existe) `dueDate` y `energyLevel` con los mismos chips/iconos que usa la tarea normal (reusar componentes de `cards/`).
2. Si no tiene, no mostrar nada (no forzar).
**Hecho cuando:** una subtarea con fecha/energía las muestra inline.

### Ticket 1.2 — Editar fecha/energía de la subtarea
**Pasos:**
1. Permitir abrir la subtarea en `TaskDetailSheet` (o un editor inline mínimo) para setear fecha/energía/prioridad.
2. Usar `useUpdateTask` (optimista, Plan 05).
**Hecho cuando:** se puede fechar/ponerle energía a una subtarea sin convertirla en tarea suelta.

### Ticket 1.3 — Crear subtarea con atributos
**Estado hoy:** `handleAddSubtask` crea solo con título.
**Pasos:**
1. Mantener el quick-add por título (Enter) pero permitir que el NL parser (Plan 01) aplique fecha/prioridad si se escriben.
**Hecho cuando:** "revisar PR mañana !2" como subtarea hereda fecha/prioridad.

---

## Sprint 2 — Relación madre ↔ hijas

### Ticket 2.1 — Progreso de la madre = % de hijas
**Estado hoy:** la madre no muestra progreso de subtareas.
**Pasos:**
1. En la tarjeta de la madre, calcular `done/total` de `getSubtasks` y mostrar una barra/`3 de 5`.
2. Selector puro y testeable para el cálculo.
**Hecho cuando:** la madre muestra el avance de sus hijas.

### Ticket 2.2 — Completar la madre no borra ni completa hijas en silencio
**Estado hoy:** completar es soft; confirmar comportamiento esperado.
**Pasos:**
1. Decidir regla explícita: completar la madre **no** toca a las hijas (o pregunta "¿completar también las N pendientes?").
2. Documentar y, si hace falta, ajustar `toggleTask` para no cascada-completar.
**Hecho cuando:** completar la madre deja a las hijas como estaban (o pregunta), nunca borra.

### Ticket 2.3 — Subtareas en la state-machine
**Estado hoy:** una subtarea con fecha puede auto-derivar a `today` igual que cualquier tarea.
**Pasos:**
1. Revisar en `tasks.state-machine.ts` / derivación de status si conviene que las subtareas no entren solas al plan del día (para no inflar "hoy" con hijas).
2. Decisión de producto: ¿las subtareas cuentan en el plan del día? Documentar.
**Hecho cuando:** queda definido y consistente cómo se comportan las subtareas fechadas en el funnel.

---

## Sprint 3 — Mostrarlas bien en todas las vistas

### Ticket 3.1 — Subtareas visibles en las vistas de tarea
**Pasos:**
1. Asegurar que el indicador de "tiene N subtareas (X hechas)" aparece en `PlanningTaskCard`, `TaskListRow`, `TaskKanbanView`.
**Hecho cuando:** en cualquier vista se ve que una tarea tiene subtareas y su avance.

### Ticket 3.2 — Epics (madre con muchas hijas) en `project`
**Pasos:**
1. En el board de `project`, tratar la madre como epic: agrupar/expandir sus hijas.
**Hecho cuando:** un epic se ve como contenedor de sus tareas en el board.

## Anti-objetivos
- Sub-subtareas (N niveles): **NO**. Limitar a 1–2 niveles (A3, evitar abrumar).
- Dependencias (`blocked_by`/`blocks`): fuera de este plan → Plan 14.
