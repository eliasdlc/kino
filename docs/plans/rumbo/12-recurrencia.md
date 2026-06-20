# PLAN 12 — Recurrencia: terminarla o enterrarla

> Origen: Sección E item 2. Esfuerzo S–M. ROI ★★.
> Idea central: la recurrencia está **a medias**: hay columnas en el schema pero no hay UI ni
> generación de ocurrencias. Es deuda colgando. Este plan fuerza una **decisión** y la ejecuta:
> o se termina como feature mínima, o se entierra explícitamente (no se deja en limbo).

## Estado hoy

- Schema: `tasks.recurrenceRule varchar(500)`, `tasks.recurrenceParentId` (self-ref `set null`),
  índice `idx_tasks_recurring`.
- Uso real: solo `isRecurring: recurrenceRule != null` como flag en la state-machine
  (`tasks.service.ts:91`), y se setea `recurrenceRule: null` al crear optimista (`tasks.hooks.ts:124`).
- **No hay**: UI para definir recurrencia, parser de regla, ni lógica que genere la próxima ocurrencia al completar.
- Existe `docs/plans/PLAN-06-recurrencia.md` (plan previo) — leer antes de ejecutar.

## Decisión requerida (elegir una)
- **(A) Terminar mínima**: recurrencias simples (diaria/semanal/mensual) que regeneran al completar.
- **(B) Enterrar**: marcar la feature como futura explícita y limpiar la deuda visible.

Recomendación: si no es prioridad de producto ahora, **(B)** para quitar deuda; volver a (A) cuando haya demanda.

---

## Sprint A — Terminar (si se elige A)

### Ticket A.1 — Definir el formato de regla
**Pasos:**
1. Decidir formato: subset de RRULE (`FREQ=DAILY/WEEKLY/MONTHLY;INTERVAL=n`) o un JSON simple.
2. Función pura `parseRecurrence(rule)` + `nextOccurrence(rule, fromDate)` con tests (patrón de función pura ya establecido, como `quick-date-parse`).
**Hecho cuando:** dada una regla y una fecha, se calcula la siguiente ocurrencia (con tests).

### Ticket A.2 — UI para definir recurrencia
**Pasos:**
1. En `CreateTaskDialog`/`TaskDetailSheet`, un selector "Repetir" (no / diaria / semanal / mensual).
2. Persistir en `recurrenceRule` (extender `tasks.schemas.ts` create/update).
**Hecho cuando:** se puede marcar una tarea como recurrente y se guarda.

### Ticket A.3 — Regenerar al completar
**Pasos:**
1. En `toggleTask`/`completeTask`, si la tarea tiene `recurrenceRule`, crear la siguiente instancia (`recurrenceParentId` apuntando a la serie) con `nextOccurrence`.
2. Cuidado con la state-machine y el plan del día.
**Hecho cuando:** completar una tarea recurrente genera la próxima automáticamente.

### Ticket A.4 — Indicador visual
**Pasos:**
1. Icono "repite" en las tarjetas de tareas recurrentes.
**Hecho cuando:** se distingue una tarea recurrente de un vistazo.

---

## Sprint B — Enterrar (si se elige B)

### Ticket B.1 — Marcar futuro explícito
**Pasos:**
1. Documentar en el roadmap que recurrencia es futura (no en limbo).
2. Cerrar/anotar `PLAN-06-recurrencia.md` como pospuesto.
**Hecho cuando:** queda registrado que no se trabaja ahora y por qué.

### Ticket B.2 — Limpiar deuda visible (sin borrar columnas)
**Pasos:**
1. Quitar referencias muertas/medias en UI que sugieran que la recurrencia funciona (si las hay).
2. Mantener las columnas del schema (baratas, no estorban) pero sin prometer la feature.
**Hecho cuando:** nada en la UI insinúa una recurrencia que no existe.

## Nota
No dejar el estado intermedio actual: o A o B. El limbo es lo único no aceptable (es el objetivo del plan).
