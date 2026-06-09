# PLAN-07 v2 — Sistemas componibles: funnel universal + presets reactivos

> Versión: 2026-06-09 (v2.1, revisión)
> Estado: **borrador revisado** — listo para ejecutar Fase 1 de inmediato; Fases 2–3 son el núcleo; Fase 4 es opcional/después.
> Cambios v1→v2: se descarta el mini-Linear de Professional; Health deja de ser un score compuesto y pasa a señales legibles; el bug del dashboard se arregla en el modelo (no en cache); se nombra explícitamente el mecanismo de "mover el headspace" (defaultTab + identidad + empty states); decisiones abiertas §5 cerradas.
> Cambios v2→v2.1: **Academic replanteado a fondo** (§2.6) — el default deja de ser Calendario; el muro de deadlines se reemplaza por una vista de foco con runway ("Esta Semana"); el cronológico se disuelve en ella; se añaden estudio según energía, breakdown de tareas grandes, import de syllabus y calificaciones quietas.

---

## 0. Problema que resuelve

Tras la fase 4 (vistas por `system_type`), los sistemas se sienten **incompletos y confusos**: cada tipo tiene una vista monolítica que reinventa su layout, no comparte el funnel y queda a medias; al reemplazar el funnel de 4 estados (que el usuario ya entendía) por una pantalla parcial, se perdió la sensación de progreso. Además dos bugs rompen la confianza: completar tareas no funciona en `/tasks` y es errático en el dashboard; el check-in pregunta el sueño en todos los slots.

### Decisión de diseño central (se mantiene)

> Un sistema **no es una vista rígida**. Es un **funnel universal** (Backlog · Planning · Action · Archived) que sirve de espina dorsal, y cada `system_type` construye encima usando el mismo flujo. Los extras de cada tipo son **tabs/módulos reutilizables**; Custom deja al usuario elegirlos.

### Lo que cambia respecto a v1 (resumen de calls)

1. **Professional NO es mini-Linear.** Sprints/velocity/ciclos no aplican a una app de un solo usuario y rompen el funnel de 4 estados. Professional = funnel base + agrupar por proyecto/cliente en Action + tab opcional de Proyectos (reusa Milestones). Ver §2.4.
2. **System Health NO es un score 0–100.** Es un set de señales legibles; la única que dispara advisor/highlight es `stale`. Ver §2.3.
3. **El bug del dashboard es de modelo:** `inTodayPlan` se desacopla de `status`. Ver §1.1.
4. **El headspace se logra con `defaultTab` + identidad visual + empty states**, no con la lista de tabs sola. Ver §2.5.
5. **Fase 1 sale como PR independiente y primero.** Ver §3.

---

## 1. Bugs raíz (diagnóstico confirmado)

### 1.1 Completar tareas

Tres claves de TanStack para la misma entidad: `['tasks','all']` (`/tasks`), `['tasks','today-plan']` (dashboard), `['tasks','system', id]` (sistemas).

- **`/tasks` ("no pasa nada"):** `AllTasksList` lee de `['tasks','all']`, pero `useToggleTodayTask` actualiza/invalida `['tasks','today-plan']`. El backend persiste; la lista nunca refetcha.
  **Fix:** la mutación de toggle invalida el **prefijo completo** `['tasks']` en `onSettled` (TanStack invalida toda query cuya key empiece con `['tasks']`). Optimista sobre la lista visible + invalidación del prefijo → las tres vistas quedan consistentes.

- **Dashboard ("a veces se devuelve"):** el endpoint `GET /api/tasks/today-plan` devuelve `inTodayPlan = true OR status = 'today'`. Una tarea que estaba por `status='today'`, al marcarse done pierde **ambas** condiciones → al refetch desaparece. La invalidación sola NO lo arregla; lo empeora.
  **Fix (modelo, no cache):** desacoplar membresía de estado.
  - `inTodayPlan` pasa a ser booleano **persistente**: `true` cuando la tarea entra al plan (por drag o por acción "hoy"); `false` al sacarla o en el rollover diario.
  - Completar → `status='done'`, **se conserva** `inTodayPlan=true` → sigue visible (tachada) hasta el rollover.
  - El endpoint filtra solo por `inTodayPlan = true`; se elimina el `OR status='today'`.
  - *(Parche barato si se quiere evitar migración ya: incluir done-in-plan en el criterio. La solución limpia es el desacople.)*

- **Hecho cuando:** completar una tarea funciona igual en `/tasks`, dashboard y vista de sistema, sin rebote.

### 1.2 Check-in multi-slot

`EnergyBatteryCard.tsx` muestra siempre "¿Cómo dormiste?" (líneas 361–379).
**Fix:** bloque de sueño **solo en slot mañana**; tarde/noche solo nivel de energía. `sleepQuality` opcional en `energy.schemas`/backend.
**Hecho cuando:** el check-in de la tarde no pide sueño.

---

## 2. Arquitectura objetivo

### 2.1 Módulos de tab reutilizables

Un set de módulos de vista que cualquier sistema monta. Cada módulo recibe `system` + tareas y comparte `TaskCard`, `TaskDetailSheet`, hooks de mutación y la lógica de "completar" ya corregida en Fase 1.

| Módulo | Qué hace | Reusa hoy |
|---|---|---|
| `BacklogTab` | tareas sin fecha / sin planificar | `TaskBacklogView` |
| `PlanningTab` | triage y programación | `TaskPlanningView` |
| `ActionTab` | foco ejecutable; **agrupar por energía / prioridad / proyecto** en columnas | `TaskActionView` + `groupBy` de `SystemPersonalView` |
| `ArchivedTab` | completadas / archivadas | `TaskArchiveView` |
| `MilestonesTab` | milestones/proyectos CRUD + progreso | `folders` + `SystemEntrepreneurialView` |
| `EstaSemanaTab` | foco académico: runway (Hoy ≤3 / Tiene tiempo / Más adelante) + señal "vas bien" | `estimate_task` + `dueDate` + límite de 3 |
| `ClassesTab` | cada clase como "hogar" (ID + nombre, próxima entrega, notas, horario) | metadata `course` |
| `CalendarTab` | grilla mensual de entregas (zoom-out, no default) | base del timeline académico |
| `KanbanTab` | columnas por estado base | `SystemProfessionalView` |

> El `groupBy` de `ActionTab` es el mismo motor para "por energía", "por prioridad" y "por proyecto/cliente". Una sola pieza sirve a Personal, Custom y Professional.

### 2.2 Presets por `system_type`

`SYSTEM_TYPE_CONFIG` se extiende con `tabs[]`, `defaultTab` y orden. `SystemDetailView` arma los tabs desde el preset (deja de elegir un componente monolítico).

| Tipo | Tabs por defecto | `defaultTab` |
|---|---|---|
| **inbox** | Backlog · Planning · Action · Archived | Action |
| **personal** | Backlog · Planning · Action · Archived | Action (group by energía) |
| **custom** | base + **selector de tabs** del usuario | configurable |
| **academic** | Esta Semana · Clases · Calendario · Planning · Archived | Esta Semana |
| **entrepreneurial** | Milestones · Backlog · Planning · Archived | Milestones |
| **professional** | Action(group by proyecto) · Backlog · Planning · Archived · *Proyectos (opc.)* | Action |

### 2.3 Header reactivo + señales (no score)

Reemplazar el header estático por una **fila compacta** (menos padding, más espacio vertical). El identity statement y el trigger context se mueven al detalle/edición.

Stats reactivos en el header:
- **Estado del sistema:** `activo` / `stale` (chip legible, no número).
- Frecuencia/racha real vs `expectedFrequency`.
- Nº de tareas activas + próxima entrega.

> **No se calcula un Health 0–100.** Razón: cuatro pesos `w1..w4` sin forma de fijarlos = adivinanza; un número compuesto que destaca sistemas y dispara el advisor se siente arbitrario y regañón (anti-Kino), y esconde el *porqué*. En su lugar, **señales legibles y accionables**.
>
> Única señal que dispara advisor + highlight en `/systems`: **`stale`** = sin tarea completada en N días relativo a `expectedFrequency`. Backend ya disponible: `staleTemplate`, `find_stale_systems` (MCP), `expectedFrequency`. El `energyIdeal` se usa en `ActionTab` (group by energía), no en un score.

### 2.4 Professional = trabajo por proyecto/cliente (no Linear)

Caso real para un usuario solo: un freelance que lleva trabajo de varios clientes/proyectos con entregas. **No** sprints, **no** velocity, **no** estados nuevos — eso es coordinación de equipo y rompería el funnel de 4 estados.

- Funnel base de 4 estados (sin estados Linear).
- `ActionTab` con **group by proyecto/cliente** (mismo motor que energía/prioridad).
- Tab opcional **Proyectos**: reusa `MilestonesTab` sobre `folders` (un "proyecto" = un folder con metadata).
- **Futuro (fuera de alcance):** board kanban dedicado, vínculo tarea↔issue de GitHub. Solo si el caso lo pide; no especular ahora.

### 2.5 Mecanismo de "mover el headspace" (nuevo, explícito)

El headspace no lo da la lista de tabs; lo dan tres cosas baratas:
1. **`defaultTab` por preset** (tabla §2.2): lo primero que ves al abrir el sistema = su modo mental (Academic→Esta Semana/foco calmado; Personal→Action por energía; Emprendimiento→Milestones).
2. **Identidad visual:** color/ícono del sistema (ya existen) como acento del header.
3. **Empty states específicos** por tab ("Aún no hay milestones — crea el primero"). Gran parte del "se siente incompleto/confuso" son empty states genéricos.

### 2.6 Academic = la mejor versión de una herramienta de estudiante (replanteo)

Es el tipo que más gente va a usar y el diferenciador público. La trampa de casi todos los planners de estudiantes es tratar el problema como uno de *organización* (más vistas, calendarios bonitos) cuando es **emocional**: el estrés del estudiante es **el muro** — abres la app, ves 14 entregas y te congelas. Un calendario lleno es un muro más bonito; sigue estresando.

> **Tesis:** Academic no es "más vistas de la lista de tareas". Es el alma de Kino (límite de 3, energía, Startability) aplicada al semestre. Lo que relaja no es ver todo ordenado, es ver *poco* y tener *certeza*: "3 cosas hoy, lo demás tiene tiempo, vas bien."

**Mecanismos (en orden de impacto):**

1. **`EstaSemanaTab` (default) — foco con runway, no calendario.** Responde una sola pregunta: *¿estoy bien?* Cada tarea tiene estimación de esfuerzo (`estimate_task`) + `dueDate`. Con eso se calcula un *runway* simple (días hasta entrega vs esfuerzo) y se bucketea: **Hoy** (máx 3, respetando el límite duro de Kino), **Tiene tiempo**, **Más adelante**. Arriba, una línea cálida: "Vas al día — 2 cosas hoy, lo demás tiene espacio." Es una **heurística, no un scheduler optimizador** (no entrar ahí). El cronológico de v2 se disuelve aquí: misma info, sin el efecto tranquilizador.

2. **Romper lo grande — el dread real.** "Estudiar para el parcial de FIS139" no asusta por el trabajo sino por ser enorme y no-empezable. Al crear una tarea grande, ofrecer proactivamente `generate_subtasks` + Startability → sesiones pequeñas ("repasar cap. 3, 45 min" · "ejercicios impares"). Mata el dread *y* reparte el esfuerzo en días, alimentando el runway de (1).

3. **Estudiar según tu energía — ángulo único.** Ningún planner lo hace. Tarde con energía baja → sugiere la lectura, no el problem set. Es la feature de energía de Kino, gratis, y se siente como que la app te cuida.

4. **Import de syllabus — la magia que la vuelve "la que todos buscaban".** La razón #1 de abandono de planners es la fricción de meter todo a mano al inicio del cuatrimestre. "Suelta tu syllabus (PDF) → extraigo las entregas, tú confirmas." Factible con la integración Claude/MCP existente; aun semi-automático elimina el mayor punto de abandono.

5. **Calificaciones en silencio — postura de diseño.** La mitad de los planners son máquinas de ansiedad porque gritan "esto vale 40%". La versión que *relaja* baja el volumen de las notas: opcional, discreta, **nunca en la vista de foco**. El tool se enfoca en "¿estás haciendo el trabajo y vas a tiempo?", no en "¿vas a reprobar?".

6. **Clases como hogares, no como filtro.** `ClassesTab`: cada clase es un mundo — **ID + nombre juntos** (ICC-352 — Programación…), próxima entrega, notas/materiales, horario. Calendario queda como zoom-out secundario.

7. **Cierre + Dopamine Accounting.** Al despachar el foco de la semana → estado calmado "semana bajo control" + crédito en Dopamine Accounting. Es el premio que hace que vuelvan.

**Corte de alcance (no construir todo de una):**
- **Núcleo (lo que ya se siente como la mejor versión):** `EstaSemanaTab` con runway de 3 · reuso de energía + breakdown en tareas académicas · `dueDate` con hora.
- **Segunda ola:** `ClassesTab` como hogares · import de syllabus (pesa más, pero es el diferenciador público).
- **Después:** horario recurrente de clases · calificaciones quietas.

---

## 3. Fases

### Fase 1 — Fundaciones (bugs + check-in) · **PR independiente, primero**
**Objetivo:** restaurar confianza. No depende de la arquitectura; mergear y usar unos días antes de seguir.
- Toggle de tareas: optimista sobre la lista visible + `invalidateQueries(['tasks'])` en `onSettled`.
- `inTodayPlan` persistente, desacoplado de `status`; endpoint `today-plan` filtra solo por `inTodayPlan=true`; rollover diario limpia el flag.
- Check-in: sueño solo en slot mañana; `sleepQuality` opcional.
- **Hecho cuando:** completar funciona igual en las tres vistas; el check-in de la tarde no pide sueño.

### Fase 2 — Funnel universal componible (el premio)
**Objetivo:** módulos reutilizables montados vía preset; inbox/personal/custom sobre la base.
- Extraer `Backlog/Planning/Action/Archived` como módulos compartidos.
- `ActionTab`: group by energía / prioridad / proyecto en columnas.
- Extender `SYSTEM_TYPE_CONFIG` con `tabs[]` + `defaultTab`; `SystemDetailView` arma desde preset.
- Migrar inbox, personal y custom (Custom = base + selector de tabs persistido en `metadata`).
- Header compacto + empty states + identidad visual (§2.5).
- **Hecho cuando:** inbox/personal/custom usan el funnel componible; Custom añade tabs; abrir un sistema te pone en su `defaultTab`.

### Fase 3 — Presets Academic + Entrepreneurial
**Objetivo:** identidad real de los dos tipos con caso de uso claro.
- **Academic — núcleo (§2.6):** `EstaSemanaTab` con runway de 3 + señal "vas bien"; reuso de energía + `generate_subtasks` en tareas académicas; `dueDate` → timestamp con hora (una migración); `CalendarTab` como zoom-out.
- **Academic — segunda ola:** `ClassesTab` como hogares (ID + nombre, próxima entrega, notas, horario); import de syllabus (PDF → entregas, semi-automático con confirmación).
- **Entrepreneurial:** `MilestonesTab` con **CRUD real** (falta el handler de creación); default tab Milestones; empty state.
- **Professional:** group by proyecto en Action + tab Proyectos (reusa Milestones/folders). Sin sprints.
- **Hecho cuando:** abrir Academic te pone en "Esta Semana" con máx 3 hoy y el resto con tiempo; se puede crear un milestone; las entregas tienen hora.

### Fase 4 — Header reactivo + señal `stale` · **opcional / después**
**Objetivo:** exponer frecuencia de uso de forma legible.
- Servicio que marca `stale` vs `expectedFrequency`.
- Header reactivo: chip estado, racha vs esperada, activas, próxima entrega.
- `stale` destaca en `/systems` y conecta el advisor (`advisorTemplate`/`staleTemplate`).
- **Hecho cuando:** el header refleja uso real sin score compuesto.

---

## 4. Archivos previsiblemente afectados

- Bugs: `src/features/tasks/tasks.hooks.ts`, `src/app/api/tasks/today-plan/route.ts`, `src/features/tasks/AllTasksList.tsx`, `src/features/dashboard/TodayPlanCard.tsx`, `src/features/dashboard/EnergyBatteryCard.tsx`.
- Arquitectura: `src/shared/lib/system-types.ts`, `src/features/systems/views/*`, `src/features/tasks/Task{Backlog,Planning,Action,Archive}View.tsx`.
- Presets: vistas académicas/emprendimiento/professional + `src/features/folders/*`.
- Header/señal: `src/features/systems/SystemDetailHeader.tsx`, `systems.service.ts`, `SystemsList.tsx`.

---

## 5. Decisiones abiertas — **cerradas**

1. **Sprints:** descartado (no hay mini-Linear). "Proyectos" de Professional reusa `folders`. Sin tabla nueva.
2. **Hora de entrega (Academic):** `dueDate` → timestamp con hora. Sin campo aparte (sincronizar dos campos es footgun).
3. **Selector de tabs de Custom:** persistido en `metadata` (JSON) del sistema. Sin columna nueva.
4. **Pesos de Health:** eliminada — no hay score; solo señal `stale`.
5. **Estados Linear (Professional):** eliminada — usa los 4 estados base.
6. **Runway (Academic):** heurística (días hasta entrega vs esfuerzo de `estimate_task`), no scheduler optimizador. Tope de 3 en "Hoy".
7. **Calificaciones (Academic):** opcionales y discretas; nunca en la vista de foco. Postura anti-estrés, no feature central.
8. **Import de syllabus:** segunda ola; semi-automático (extraer → confirmar), no confiar en extracción 100% automática.
