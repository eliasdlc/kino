# PLAN-08 — Cierre de gaps del PLAN-07

> Versión: 2026-06-09
> Estado: **listo para ejecutar** — G1 es chico y desbloquea la queja principal; G2/G3 comparten una sola pieza; G4 es decisión de producto (no se codea hasta resolverla).
> Origen: auditoría criterio-por-criterio del PLAN-07 contra el código real. La mayoría del plan se cumplió; esto cierra lo que quedó declarado "hecho" sin estarlo.

---

## 0. Por qué existe este plan

El PLAN-07 se cerró con tres criterios "Hecho cuando" sin cumplir, uno de ellos
**anotado en el propio plan** ("falta el handler de creación", línea 167). La causa
no fue técnica: la plomería de milestones existe entera. Fue que **"Hecho cuando"
nunca se ejecutó como prueba**. Este plan los cierra y deja una regla de proceso
al final (§4) para que no se repita.

### Resumen de la auditoría

| Fase PLAN-07 | Estado | Nota |
|---|---|---|
| Fase 1 (bugs + check-in) | ✅ completa | toggle invalida `['tasks']`, `inTodayPlan` persistente, sueño solo en `morning` |
| Fase 2 (funnel componible) | ⚠️ 1 gap | falta `groupBy: 'project'` en ActionTab → **G2** |
| Fase 3 (Academic / Emprend. / Prof.) | ❌ gaps | Academic núcleo ✅; **milestones no se crean → G1**; **Professional sin group-by-proyecto → G3** |
| Fase 4 (señal stale + header) | ✅ completa | NO hay score 0–100 **a propósito** (§2.3 del PLAN-07) → ver **G4** |

Fuera de alcance (el PLAN-07 ya los marcó "segunda ola / después", no son
incumplimiento): `ClassesTab` académico e import de syllabus.

---

## 1. G1 — Crear milestones en Emprendimiento *(la queja principal)*

### Diagnóstico
`SystemEntrepreneurialView.tsx` renderiza folders como milestones (`useFolders`)
pero **no tiene forma de crear uno**: el único control es `<CreateTaskDialog>`
(crea tareas, no folders). El empty state promete *"Crea el primer milestone →
Nuevo milestone"* (línea 120) apuntando a un botón inexistente.

La plomería ya está toda:
- `useCreateFolder(systemId)` — `folders.hooks.ts:37`, payload `{ name, color?, parentId? }`.
- Endpoint `POST /api/systems/[id]/folders` y `folders.service.ts`.
- Patrón de UI ya resuelto: input inline en `SystemTreeItem.tsx:77` (`createFolder({ name })` + Enter/blur). **Seguir ese patrón, no inventar un dialog nuevo.**

### Implementación
- En `SystemEntrepreneurialView.tsx`: añadir control "Nuevo milestone" (input inline
  estilo `SystemTreeItem`, o botón que despliega el input) que llame a
  `useCreateFolder(system.id)`.
- Conectar el empty state existente (líneas 118–122, 159–162) a ese control para
  que el texto deje de ser fantasma.

### Sub-decisión G1b — el "KPI" está muerto
La vista lee `(folder as { description?: string }).description` como KPI
(línea 132), pero **la tabla `folders` no tiene columna `description`** ni el
`createFolderSchema`/`updateFolderSchema` lo aceptan. Hoy ese KPI nunca se llena.
Dos caminos:
- **(a) Mínimo:** crear milestone solo con `name`; **eliminar** el display de KPI
  muerto del accordion. Cero migración.
- **(b) Completo:** agregar columna `description` a `folders` (migración) + campo en
  los schemas + input opcional "KPI" al crear. Más trabajo.

→ Por defecto **(a)**, salvo que quieras el KPI ahora.

### Hecho cuando
- Abrir un sistema de Emprendimiento permite crear un milestone visible al instante.
- No queda ningún texto de empty state apuntando a un control inexistente.

---

## 2. G2 — `groupBy: 'project'` en `TaskActionView`

### Diagnóstico
`TaskActionView.tsx:32` define `ActionGroupBy = "energy" | "priority"`. El PLAN-07
(§2.1 y §2.4) pedía un tercer modo **por proyecto/cliente** (`folderId`), que es la
pieza compartida que Professional necesita en G3.

### Implementación
- Extender `ActionGroupBy` a `"energy" | "priority" | "project"`.
- En `taskGroupKey` (línea 54): para `"project"`, la clave es `task.folderId` (o
  `"sin-proyecto"`).
- Columnas dinámicas desde los folders del sistema (`useFolders`) en vez de las
  estáticas `ENERGY_COLUMNS`/`PRIORITY_COLUMNS`.
- El drag entre columnas en modo proyecto debe setear `folderId` (igual que hoy
  setea `priority`/`energyLevel`, líneas 110–113).
- Exponer el selector de modo en el header del tab.

### Hecho cuando
- En cualquier sistema con folders, ActionTab ofrece "por proyecto" y mueve tareas
  entre proyectos arrastrando.

---

## 3. G3 — Professional agrupa por proyecto

### Diagnóstico
`SystemProfessionalView.tsx` es un kanban por `status`. El PLAN-07 (§2.4, Fase 3)
pedía **funnel base + Action group-by-proyecto/cliente + tab Proyectos opcional**,
explícitamente **sin** sprints/velocity.

### Implementación
- Reusar G2: Professional monta `TaskActionView` con `groupBy="project"` por defecto
  (proyecto = folder), conservando el kanban por status como otra vista si se quiere.
- Tab "Proyectos" opcional: reusa la UI de milestones de G1 sobre `folders`.
- **No** agregar estados nuevos ni tabla nueva (decisión §5.1/§5.5 del PLAN-07).

### Hecho cuando
- Abrir Professional muestra el trabajo agrupable por proyecto/cliente; los proyectos
  son folders, sin estados Linear.

---

## 4. G4 — Decisión de producto: ¿score de health? *(no se codea aún)*

La Fase 4 **sí se implementó**: señal `stale` (`systems.signals.ts`), header
reactivo con chip de estado, tareas activas, próxima entrega y advisor
(`SystemDetailHeader.tsx:98`). Lo que **no** existe es un *health score 0–100* —
y el PLAN-07 §2.3 lo **descartó a propósito** (cuatro pesos sin forma de fijarlos,
número arbitrario y regañón, anti-Kino).

Si la percepción de "falta system health" venía de esperar ese número, hay que
decidir explícitamente:
- **(a) Mantener** solo la señal `stale` (status quo del plan). Sin trabajo.
- **(b) Reintroducir** un score → requiere su propio mini-plan: definir qué mide,
  cómo se fijan los pesos, y dónde se muestra sin sentirse regañón.

→ **Decisión tuya.** Hasta resolverla, no se toca nada de health.

---

## 5. Archivos afectados (previsión)

- **G1:** `src/features/systems/views/SystemEntrepreneurialView.tsx` (+ `folders.schemas.ts`,
  `schema.ts`, migración **solo si G1b-(b)**).
- **G2:** `src/features/tasks/TaskActionView.tsx`.
- **G3:** `src/features/systems/views/SystemProfessionalView.tsx` (reusa G1+G2).
- **G4:** ninguno hasta decidir.

## 6. Regla de proceso (para no repetir el patrón)

Antes de declarar una fase/plan "hecho": ejecutar **cada** frase "Hecho cuando"
como prueba manual real en la app, no como afirmación. Si un criterio menciona un
botón/acción ("se puede crear un milestone"), abrir esa vista y hacer la acción.
Los gaps de este plan habrían saltado en segundos con esa verificación.
