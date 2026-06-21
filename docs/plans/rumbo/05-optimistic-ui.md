# PLAN 05 — Optimistic UI generalizado

> Origen: Sección E item 6 (A1). Esfuerzo S–M. ROI ★★★★.
> Idea central: el patrón optimista ya existe en algunas mutaciones de tareas; generalizarlo a
> **toda mutación** para que la app se sienta instantánea, con rollback claro en `onError`.

## Estado hoy

- `tasks.hooks.ts` ya tiene optimismo en varias mutaciones: create (`onMutate` con tarea
  placeholder `userId:"optimistic"`, `tasks.hooks.ts:76`), toggle (`:202`), move (`:252`),
  delete (`:300`), con `onError` que restaura `previous` y `onSettled`/`onError` que invalida.
- **Inconsistente fuera de tasks**: otras features (pages, folders, sprints, sticky-notes,
  systems) tienen mutaciones que probablemente solo invalidan sin update optimista
  (hay cambios sin commitear en sus `.hooks.ts` ahora mismo — revisarlos primero).
- TanStack Query v5 soporta esto sin librerías nuevas.

## Estrategia
No reescribir todo de golpe. (1) Documentar **un patrón canónico** de mutación optimista.
(2) Aplicarlo feature por feature, priorizando las mutaciones que el usuario siente más.

---

## Sprint 1 — Patrón canónico + auditoría

### Ticket 1.1 — Extraer el patrón a un helper documentado
**Estado hoy:** el patrón está copiado inline en cada mutación de tasks.
**Pasos:**
1. Revisar las 4 mutaciones optimistas de `tasks.hooks.ts` y extraer la forma común:
   `onMutate` (cancelQueries + snapshot + setQueryData), `onError` (restore snapshot),
   `onSettled` (invalidate).
2. Crear un helper genérico en `src/shared/hooks/` (p. ej. `useOptimisticMutation` o un
   factory `makeOptimisticListMutation`) **solo si reduce duplicación real** (regla de las 3+
   ocurrencias ya se cumple). Si el helper se vuelve abstracto/confuso, dejar el patrón documentado y copiar.
3. Documentar el patrón con un comentario de referencia.
**Hecho cuando:** existe una única fuente de verdad del patrón (helper o doc) y tasks lo usa sin regresión.

### Ticket 1.2 — Auditoría de mutaciones sin optimismo
**Pasos:**
1. Listar todas las mutaciones por feature: `grep "useMutation" src/features/**/**.hooks.ts`.
2. Marcar cuáles solo invalidan (sin `onMutate`).
3. Priorizar por "cuánto se nota la latencia" (toggles, drags, renombres, pins).
**Hecho cuando:** hay una lista priorizada de mutaciones a optimizar.

---

## Sprint 2 — Aplicar por feature (un ticket por feature)

> Cada ticket: añadir `onMutate`/`onError`/`onSettled` siguiendo el patrón del Sprint 1.
> Verificar rollback forzando un error (devolver 500 temporal o desconectar red).

### Ticket 2.1 — Sticky notes
**Pasos:**
1. Aplicar optimismo a crear/mover/editar/borrar sticky (cuidado con `position` — last-write-wins por `updatedAt`).
2. Probar rollback.
**Hecho cuando:** arrastrar/editar una sticky se siente instantáneo y revierte si falla.

### Ticket 2.2 — Pages / notebooks
**Pasos:**
1. Optimismo en pin, rename, crear, borrar página (autosave de contenido ya es debounce, no tocar).
**Hecho cuando:** las acciones de lista de cuadernos son instantáneas.

### Ticket 2.3 — Folders
**Pasos:**
1. Optimismo en crear/renombrar/mover/borrar carpeta.
**Hecho cuando:** el árbol responde sin esperar al server.

### Ticket 2.4 — Systems
**Pasos:**
1. Optimismo en renombrar/archivar/editar sistema.
**Hecho cuando:** editar un sistema se refleja al instante.

### Ticket 2.5 — Sprints
**Pasos:**
1. Optimismo en crear/cerrar sprint y asignar tarea.
**Hecho cuando:** acciones de sprint instantáneas.

---

## Sprint 3 — Garantías

### Ticket 3.1 — Prueba de rollback estándar
**Pasos:**
1. Para cada mutación tocada, un test (o checklist manual) que fuerce error y verifique que la UI vuelve al estado previo.
**Hecho cuando:** todas las mutaciones optimistas revierten limpio en error.

### Ticket 3.2 — Evitar estados inconsistentes con keys
**Pasos:**
1. Confirmar que cada `setQueryData` toca las mismas keys que el `onSettled` invalida (riesgo A1: optimismo mal hecho deja estado inconsistente).
**Hecho cuando:** no hay desajustes entre la key optimista y la invalidada.

## Riesgos
- Optimismo mal hecho deja estados inconsistentes → snapshot + restore obligatorio.
- No abstraer de más: si el helper genérico complica, preferir patrón documentado + copia.
