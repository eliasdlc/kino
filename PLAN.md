# Kino — Plan de Hardening y Pulido de Core

> Estado: activo · Última actualización: 2026-06-08
> Objetivo: convertir Kino de "solo lo usa Elías" a una app organizada, coherente y lista para el público.

---

> ### ⚙️ Antes de implementar cualquier fase: leer `DECISIONS.md`
>
> Este PLAN define **qué** construir y las decisiones de **producto**. El archivo `DECISIONS.md`
> define **cómo** construirlo: algoritmos exactos, patrones de estado, librerías, fórmulas y gotchas.
>
> **Regla para la IA**: al arrancar una fase, leer la sección correspondiente de `DECISIONS.md`
> (referenciada en cada fase con el bloque **🔧 Decisiones de ingeniería**) **además** de la
> sección global **§0** (estándares que aplican a todo: data fetching, optimistic updates, Zod,
> fechas/timezone, animaciones, charts). No improvisar un patrón distinto al estándar global.
> Si una decisión de implementación no está cubierta, el default es: **el patrón de §0 de `DECISIONS.md` manda.**

---

## Diagnóstico raíz

Kino tiene dos cerebros desconectados: un backend inteligente (energía cognitiva, cronotipo, advisor, detección de patrones, MCP con ~50 tools) y una UI que expone ~30% de esa inteligencia. `typecheck` y `lint` pasan en 0 — la deuda no es de tipos, es de **producto y arquitectura de UI**.

### Problemas críticos

| # | Problema | Evidencia |
|---|----------|-----------|
| C1 | Sin landing, sin docs | `app/page.tsx` solo redirige; `README.md` default |
| C2 | El diferenciador (energía/inteligencia) está invisible | `insights.service` sin imports en `.tsx` |
| C3 | Dashboard requiere scroll — pierde su sentido de "vista de control" | 7 cards condicionales apiladas |
| C4 | "Plan de hoy" es solo lectura, no se puede accionar ahí mismo | `TodayPlanCard` sin completar/mover/enfocar inline |
| C5 | Gráfica de energía incomprensible — sin marcador de hora actual | Multi-checkin no existe; sin confirmación de predicción |
| C6 | Vista /tasks: textos cortados, sin filtros, sin propósito claro | Grid con "Tare..." en cada card; sin Kino recommendations |
| C7 | Timer descubrible solo por casualidad, sin payoff | Sin auto-stop, sin sonido, sin visibilidad de tiempo acumulado |
| C8 | Formulario de tareas abrumador | Todos los inputs en un dialog sin flujo progresivo |

### Problemas altos

| # | Problema |
|---|----------|
| A1 | `AGENTS.md`/`CLAUDE.md` describen billing, sync, Premium guards, `focus/` como si existieran — no existen |
| A2 | **CRÍTICO**: `system_type` es decorativo — debería ser arquitectural (vistas/estados/campos diferentes por tipo) |
| A3 | `task_type` no tiene efecto real: idea/event/reminder/habit ≡ task |
| A4 | Funnel Planning vacío — las tareas no aparecen porque requieren `startDate` sin comunicarlo |
| A5 | Backlog no funciona como staging area para Planning |
| A6 | `estimatedTime` con input numérico — nadie lo llena |
| A7 | "Descanso recomendado" hardcodeado sin respaldo de backend |
| A8 | `timeLogs` y `systemHealth` capturan datos que el usuario nunca ve |

### Problemas medios

| # | Problema |
|---|----------|
| M1 | "Kino te conoce" y "Últimos 7 días" muestran datos sin utilidad accionable |
| M2 | `tasks/` 5.097 LOC con lógica de scoping duplicada |
| M3 | Sticky notes sin captura rápida global |
| M4 | MCP puede más que la UI — paridad rota |

---

## Decisiones de rumbo (Elías, 2026-06-08)

1. **Identidad → Exponer la inteligencia**: energía/cronotipo/advisor visibles y centrales.
2. **Features fantasma → Marcar como futuros**: billing, sync, quests, inventory, Premium guards → roadmap. Schema intacto.
3. **Prioridad → Pulir el core (retención)**: app excelente antes de traer usuarios. Landing/docs después.
4. **System_type → Arquitectural, no decorativo**: cada `system_type` (`academic`, `professional`, `entrepreneurial`, `personal`, `custom`) tiene UI/estados/campos/lógica completamente distintos. Una app dentro de la app.
5. **Funnel → Dinámico por system_type**: no es "Backlog/Planning/Action/Archive" para todos. Cada tipo tiene su propia vista (timeline, kanban, progress, list, custom).
6. **Vista `/tasks` → Smart Daily Focus**: Kino genera un plan recomendado para el día basado en urgencia + salud de sistemas + energía. El usuario puede trabajar sobre él ahí mismo (quest mode).
7. **Planning → Solo por sistema**: la vista de organización vive en `/systems/[id]`. `/tasks` tiene su propia forma de organizar el día (distinta al Planning semanal).
8. **Plan completo → Celebración + sugerencias**: cuando el usuario termina todas las tareas del día, Kino celebra y sugiere qué hacer con la energía restante.

---

## Decisiones técnicas tomadas

*(No requieren consulta — definen la implementación)*

1. **Dashboard**: diseñado para 1280px (laptop 13-14"). Cards scrollables internamente; el contenedor no scrollea.
2. **Crear tarea → Dialog progresivo (3 pasos). Editar tarea → Sheet lateral**. Experiencias distintas con propósito distinto.
3. **Timer sound**: Web Audio API, tono sintetizado. Sin archivos de audio; funciona offline (PWA).
4. **Session recap del timer**: toast persistente (no desaparece solo) con 3 botones de energía. No bloquea el flujo.
5. **Validación de fechas coherentes**: warning visual, no auto-corrección. Respeta la intención del usuario.
6. **Filtros en `/tasks`**: estado en URL query params con `useSearchParams` nativo. Sin nueva librería.
7. **`habit` sin recurrencia**: solo icono 🔁 y badge de tipo. Sin streak hasta que exista recurrencia (streak sin historial de completado recurrente sería una ilusión).
8. **Schema de `energyCheckins` — migración triple** (todo en una PR junto con Fase 1.3):
   - Eliminar `uniqueIndex('uq_checkin_user_date')` (hoy bloquea multi-checkin).
   - Añadir enum `checkin_slot: 'morning' | 'afternoon' | 'evening'` y columna `slot checkinSlotEnum('slot').notNull()`.
   - Nuevo unique: `(userId, date, slot)` — un checkin por slot por día.
   - Añadir columna `prediction_accuracy: 'accurate' | 'partial' | 'inaccurate' | null` nullable.
   - El session recap post-focus actualiza el checkin del slot activo (no crea fila adicional). No hay campo `source`.
9. **Status enum — modelo simplificado**: `backlog | planning | action | done`. Eliminados: `week → action`, `today → action` (+ `dueDate = CURRENT_DATE` en migración de datos), `tomorrow → action` (+ `dueDate = CURRENT_DATE + 1`), `archived → done`. `planning` es un estado **nuevo** — requiere `ALTER TYPE task_status ADD VALUE 'planning'` en Postgres antes del Drizzle migrate. Una tarea entra a `planning` desde el ritual semanal y pasa a `action` automáticamente al organizar. El usuario puede mover tareas a cualquier estado manualmente. "Plan de hoy" es un algoritmo, no un status. Migración: misma PR que Fase 4. Al migrar, actualizar `getSuggestedTasks` para filtrar por `['action']` en lugar de `['today', 'tomorrow', 'week']`. **Tareas vencidas** (`dueDate < TODAY`, `status = 'action'`): siguen apareciendo en el Plan de hoy del Dashboard con badge 'Vencida'. No se mueven automáticamente — el usuario las completa o las mueve.
10. **Plan sugerido de `/tasks`**: se genera una vez por día al primer load. Cacheado en estado React local. Botón `[Regenerar sugerencias]` para forzar regeneración manual. Sin reset automático durante la sesión. Sin botón de "descartar" — el usuario ignora, mueve al plan o completa.
11. **`in_today_plan` — columna explícita en `tasks`**: `boolean`, default `false`. "Agregar al plan de hoy" activa el flag; "Quitar del plan" lo desactiva sin tocar `dueDate`. El dashboard muestra tareas donde `in_today_plan = true`. Esto diferencia el plan comprometido de cualquier tarea de action con fecha de hoy. Migración: Drizzle Kit, misma PR que Fase 1.2.
12. **CreateTaskDialog — memoria de paso**: estado React local, se resetea al cerrar. Regla de apertura: contexto explícito (sistema) > memoria. Desde un sistema: siempre Paso 1. Desde QuickAdd global: recuerda último paso activo.
13. **Timer — audio**: Web Audio API (tono sintetizado) al expirar. Notificación push al expirar el timer = roadmap futuro. No reutilizar el SW de task reminders para esto.
14. **`getSuggestedTasks` — algoritmo simplificado**: prioridad + urgencia + energía. `systemHealth` eliminado del algoritmo (no aporta suficiente señal en esta etapa). El endpoint `/api/insights/suggest` ya existe. Sin lógica de energía/urgencia en el componente React.
15. **Correlación en "Últimos 7 días"**: query nueva en backend (cruza tareas completadas por día con días que tuvieron checkin). Solo se muestra si hay ≥14 días de historial. Con menos data: `"Con más check-ins, Kino aprenderá cuándo rendís mejor."` Sin valores de correlación hardcodeados.

---

## SYSTEM_TYPE_CONFIG — Identidad de cada área de vida

Fuente de verdad centralizada en `lib/system-types.ts`. Define cómo actúa Kino para cada tipo de sistema.

| Tipo | Icono | Vista | Estados principales | Campos extras | Energy default | Consejo típico |
|------|-------|-------|-------------------|----------------|---|---|
| **academic** | 🎓 | Timeline (calendario entregas) | idea \| studying \| draft \| submitted \| feedback \| done | course, professor, syllabus, collaborators | medium | "Próxima entrega en {days} — ¿cuándo empiezas?" |
| **professional** | 💼 | Kanban (tablero estados) | backlog \| planned \| in-progress \| blocked \| review \| done | project, assignee, dependencies, reviewer | high | "{n} tareas bloqueando a otros — crítico hoy." |
| **entrepreneurial** | 🚀 | Progress (milestones) | idea \| validating \| building \| launched \| scaling \| done | milestone, kpi, hypothesis, learnings | high | "Velocidad esta semana: {X} — {comparison} que semana anterior." |
| **personal** | 🌟 | List (flexible) | idea \| planning \| active \| paused \| completed | why, recurrence, reflection | flexible | "Buen ritmo — {n} tareas esta semana." |
| **custom** | ⚙️ | User-defined | User-defined | User-defined | user-defined | "Tu sistema, tus reglas." |
| **inbox** | 📥 | List (mínima) | new \| triaged \| processed | (none) | N/A | "Tienes {n} items sin procesar." |

**Cada tipo tiene**:
- **Iconos y colores**: consistentes en toda la app.
- **Propósito**: describe para quién es (estudiante, profesional, emprendedor, personal, etc).
- **Lógica de automatización**: qué ocurre automáticamente (academic sugiere cuándo estudiar, professional notifica bloqueadores, etc).
- **Advisor templates**: mensajes contextuales que varían por tipo.
- **Focus mode sugerido**: duración de sesión típica (academic: 90min deep-session, professional: 25min Pomodoro, personal: flexible).
- **Documentación**: acceso a campos adicionales (syllabus, proyecto, hipótesis, etc).

**Consumidores en el código**:
- `DECISIONS.md` §Fase 0.5: estructura exacta y consumo.
- `tasks.service.ts`: valida status según type.
- `CreateTaskDialog`: qué campos mostrar depende de type.
- `/systems/[id]`: elige vista dinámicamente.
- `EnergyAdvisorBanner`: mensajes templates según type.
- `TaskCard`: qué mostrar depende de type.

---

## Referencias de producto

- **Notion**: primitivas componibles, árbol único en sidebar. Inspira jerarquía de navegación y editor de pages.
- **Todoist**: captura sin fricción, simplicidad móvil. Inspira la experiencia de `/tasks` y el BottomNav.

---

## El modelo mental de Kino (mapa de las vistas)

```
Dashboard          → Tu plan comprometido para hoy. Lo que YA decidiste hacer.
                     Accionable: completar, enfocar, mover tareas sin salir.

/tasks             → El cerebro de Kino. Qué DEBERÍAS hacer hoy según la app.
                     Recomendaciones basadas en urgencia + sistema + energía.
                     Quest mode: puedes trabajar sobre esas sugerencias ahí mismo.

/systems/[id]      → La máquina del sistema. Interfaz dinámica según system_type.
  
  academic         → Timeline de entregas. Síntesis: cuándo debo entregar qué.
  └─ Estudiar → Borrador → Entregar → Feedback → Calificado
  
  professional     → Kanban de trabajo. Síntesis: qué bloquea qué, quién hace qué.
  └─ Backlog → Planificado → En progreso → Bloqueado → Review → Done
  
  entrepreneurial  → Milestones de startup. Síntesis: validamos → construimos → lanzamos → escalamos.
  └─ Idea → Validando → Construyendo → Lanzado → Escalando → Done
  
  personal         → Lista flexible. Síntesis: haz las cosas a tu ritmo.
  └─ Idea → Planificando → Activo → Pausado → Completado
  
  custom           → Configurable por ti. Estados y campos que tú definas.
```

**La distinción Dashboard/tasks es clave**: 
- Dashboard = *tu compromiso* (tareas con `in_today_plan = true`).
- `/tasks` = *la recomendación de Kino*.
- Pueden solaparse pero son perspectivas distintas.

**La distinción sistemas por type es clave**:
- Un mismo usuario puede tener `academic | professional | entrepreneurial | personal` al mismo tiempo.
- Cada sistema tiene su propia UI/UX optimizada para esa área de vida.
- Pero comparten: Dashboard global, `/tasks` global, notificaciones globales, energía global.

---

## Plan de ejecución

---

### Fase 0 — Honestidad del repo

**Duración estimada**: 1 sesión · **Desbloquea**: todo lo demás.

> **🔧 Decisiones de ingeniería**: `DECISIONS.md` §Fase 0 (formato de `STATUS.md` como tabla; solo `.md`, no tocar código).

- [x] `AGENTS.md`: mover `billing`, `sync-*`, `focus/`, Premium guards, `quests`/`inventory` a sección **"Roadmap / no implementado"**.
- [x] Crear `docs/STATUS.md`: estado real de cada feature (hecho / a medias / futuro).
- [x] `CLAUDE.md`: quitar referencias a features fantasma como presentes.

**No tocar**: `schema.ts` (será refactorizado en Fase 0.5).

---

### Fase 0.5 — Arquitectura de system_type

**Duración estimada**: 1-2 sesiones · **Desbloquea**: Fases 1-4 (refactorización arquitectural).

> **🔧 Decisiones de ingeniería**: `DECISIONS.md` §Fase 0.5 (schema flexible, providers, validadores).

**El cambio fundamental**: `system_type` deja de ser un label cosmético. Cada tipo (`academic`, `professional`, `entrepreneurial`, `personal`, `custom`) define:
- Qué estados de tarea son válidos
- Qué campos adicionales ve el usuario
- Qué vista usa para organizar (timeline, kanban, progress, list, custom)
- Qué lógica de automatización aplica

#### 0.5.1 Schema flexible — tasks.status de enum a varchar

Hoy: `tasks.status` es un enum fijo Postgres (`'backlog' | 'planning' | 'action' | 'done'`).

Problema: si `academic` necesita `'studying' | 'draft' | 'submitted' | 'feedback'`, y `professional` necesita `'in-progress' | 'blocked' | 'review'`, el enum global explota.

**Solución**: 
- `tasks.status` → `VARCHAR`, sin enum de Postgres.
- Nueva tabla: `system_status_definitions(id, systemType, statusName, label, position, emoji)`
  - Un row por cada estado válido para un type.
  - `systemType: 'academic'` tiene rows para `studying`, `draft`, etc.
  - `systemType: 'professional'` tiene rows distintas.
- Validación en aplicación (Zod) + query de backend que retorna estados válidos para un sistema.

**Migración**:
- Drizzle migration: cambiar tipo de columna, crear tabla nueva.
- Backfill: si existen systems, asignarles un `type` por defecto (p. ej. `'personal'`).
- `tasks.status` existentes se mapean al nuevo enum: `'backlog' → 'backlog'`, etc.

#### 0.5.2 SYSTEM_TYPE_CONFIG — centralizar identidad de cada tipo

Crear archivo `lib/system-types.ts` con la configuración completa de cada tipo:

```typescript
export const SYSTEM_TYPE_CONFIG = {
  academic: { /* ... */ },
  professional: { /* ... */ },
  entrepreneurial: { /* ... */ },
  personal: { /* ... */ },
  custom: { /* ... */ },
  inbox: { /* ... */ },
} as const;
```

(Ver tabla completa en sección "SYSTEM_TYPE_CONFIG — Identidad de cada área de vida" más abajo.)

**Consumidores**:
- `tasks.service.ts`: valida status según system_type.
- Form de tareas: qué campos mostrar depende de type.
- View de sistema: qué layout usar depende de type.
- Advisor: mensajes templates según type.

#### 0.5.3 Providers y utilities

- `<SystemTypeProvider>`: proporciona `SYSTEM_TYPE_CONFIG` globalmente.
- `useSystemType(systemType)`: retorna config de ese tipo.
- `getValidStatusesFor(systemType)`: retorna enum de estados válidos.
- `getRequiredFieldsFor(systemType)`: retorna array de campos obligatorios.
- Validador Zod discriminado por `systemType`.

#### 0.5.4 Migrations de datos

Si hay systems existentes sin `type`:
- Script de migración: asigna `type = 'personal'` a todos (default).
- O: UI de bienvenida pide al usuario elegir el type de cada sistema.

**No tocar funcionalidad existente en esta fase** — solo infraestructura.

---

### Fase 1 — Dashboard: Centro de comando real

**Depende de**: Fase 0.5 (arquitectura de system_type).
**Ataca**: C2, C3, C4, C5, M1.

**Principio rector**: el dashboard entero cabe en una pantalla (1280px de referencia) y cada elemento se puede accionar ahí mismo.

**Nota de system_type**: el dashboard es agnóstico a system_type (no cambia por tipo). Pero `getSuggestedTasks` y el advisor sí son conscientes de system_type para priorizar diferente según el contexto.

> **🔧 Decisiones de ingeniería (Fase 1)**: `DECISIONS.md` §1.1–§1.5. Globales clave: §0.1 (TanStack Query), §0.2 (optimistic update con rollback — todas las acciones inline), §0.6 (fechas/slots timezone-aware), §0.8 (animaciones CSS, confeti), §0.9 (Recharts), §0.10 (lógica de scoring/energía en backend, no en cliente).

---

#### 1.1 Layout sin scroll — restricción global del dashboard

> **🔧** `DECISIONS.md` §1.1 — CSS Grid con `grid-template-areas`, `100dvh`, `clamp()`/`fr`. **Gotcha**: `min-height: 0` en hijos scrollables o el contenedor scrollea igual.

Establecer el layout fijo antes de tocar ninguna card:

```
┌──────────────────────────────────┬──────────────────┐
│                                  │  Energía + hora  │
│   Plan de hoy (quest)            │  actual          │
│   ~60% del área útil             ├──────────────────┤
│                                  │  Advisor         │
│                                  │  (1 frase + CTA) │
├────────────────┬─────────────────┴──────────────────┤
│  Hoy: X/Y done │  Kino te conoce  │  Últimos 7 días  │
│  (stats inline)│  (colapsado)     │  (colapsado)     │
└────────────────┴──────────────────────────────────────┘
```

- `WeeklyTrendsCard` y `LearningInsightCard` se colapsan en la fila inferior. Expandibles on-click.
- `NotificationPromptCard` solo aparece si no hay suscripción Y es primera visita del día. Desaparece después.
- El grid es **fijo**. Las cards son scrollables internamente si tienen muchas tareas.
- **Proporciones**: panel principal (Plan de hoy) ~60% del área útil vertical. Panel derecho: energía 55% superior, advisor 45% inferior. Fila inferior fija en ~180px. Usar `clamp()` para que no se rompa en 1024px.
- `EnergyAdvisorBanner` (Fase 1.5) se extrae y coloca en el panel derecho superior.

---

#### 1.2 "Plan de hoy" → Quest interactivo

> **🔧** `DECISIONS.md` §1.2 + §0.2 (cada acción = mutación optimista con rollback) + §0.8 (confeti/progreso CSS). "Descanso recomendado" se pinta solo donde el backend manda `breakAfterItem=true`, sin texto genérico inventado.

**Dentro de la card, sin navegar a otro lado:**

- ☑ Completar tarea (toggle + animación de tachado + confeti sutil con CSS keyframes, sin librería).
- → Mover a mañana: `dueDate = CURRENT_DATE + 1`, `status` sin cambio (botón secondary en hover de cada tarea).
- ✕ Quitar del plan de hoy (desactiva `in_today_plan = false`; la tarea permanece en Action con su `dueDate` intacto).
- ▶ Iniciar focus timer directamente desde la tarea.
- Expandir subtareas e irlas completando una a una.

**Progreso y motivación:**
- Barra de progreso animada: `X / Y tareas completadas`.
- Mensaje dinámico según contexto:
  - Sin tareas: *"Arrastra tareas desde Action para comenzar tu día"* + link rápido a `/tasks`.
  - En progreso: *"Vas al 60% — buen ritmo"*.
  - Todo hecho → ver sección siguiente.

**Cuando el plan de hoy está completo:**
- Animación de logro (no bloqueante, CSS).
- Kino muestra resumen: *"4 tareas · 2h 10min · Energía promedio: Alta"*.
- Kino sugiere 2-3 tareas de Action basadas en energía actual: *"Todavía tienes energía media. Te sugiero:"*.
- **Sin checkin del día**: el bloque de sugerencias no aparece. No se muestran recomendaciones sin energía registrada.
- Botones: `[Agregar al plan]` / `[Descansar por hoy]`. Si elige descansar, el dashboard entra en modo "día completado" y no muestra más sugerencias.

**Descanso recomendado (de backend, no hardcodeado):**
- `energy.planner.ts` genera `energyPlan.items` con slots. Añadir campo `breakAfterItem?: boolean` calculado cuando la curva cae >15 puntos entre slots consecutivos.
- UI: separador visual entre tareas con el texto *"Pausa sugerida aquí (tu energía baja a las 15h)"*, no texto fijo genérico.

---

#### 1.3 Módulo de energía — gráfica legible + multi-checkin + feedback

> **🔧** `DECISIONS.md` §1.3 — mapeo a Recharts (`ComposedChart`: Bar predicha, Scatter checkins, `ReferenceLine` hora actual, `ReferenceArea` pico). **Gotcha de migración**: `ALTER TYPE ... ADD VALUE` fuera de transacción, en migración SQL separada antes de la de Drizzle + backfill de `slot`.

**La gráfica debe mostrar:**
- Barras grises: curva predicha (24h completo).
- Puntos/línea de color: checkins registrados hoy (puede haber múltiples a diferentes horas).
- **Línea vertical punteada blanca: hora actual** — esto es lo que más falta hoy.
- Tooltip en hover: *"14h — Predicho: 72 · Registrado: 65"*.
- Zona sombreada: ventana de pico según cronotipo.

**Interacciones:**
- Tres slots por día: **Mañana** (6-12h) · **Tarde** (12-18h) · **Noche** (18-24h). Cada slot admite un solo checkin. El botón muestra el slot activo según la hora: *"Registrar energía — Tarde"*.
- Pop-up in-app (no push): aparece automáticamente cuando el slot activo no tiene checkin y el usuario lleva >10 min en la app. Es un pequeño overlay no bloqueante con el selector de energía y sueño. Desaparece al registrar o al descartarlo.
- En la gráfica: cada checkin aparece como punto coloreado en la hora del registro. La línea vertical punteada marca la hora actual.
- **Botón de feedback de predicción**: cuando hay predicción activa del día:
  > *¿La predicción está siendo correcta?*  `✓ Sí` · `~ Más o menos` · `✗ No`
  - `POST /api/energy/checkin` con campo `predictionAccuracy: 'accurate' | 'partial' | 'inaccurate'`.
  - El servicio ajusta `learningAlpha` en `userEnergyProfile` según la frecuencia de feedback negativo.
- Sin checkin del día: gráfica en modo "pending" con CTA prominente.

**Cambios de schema** (ver Decisión técnica 8 — migración triple, misma PR).

---

#### 1.4 "Kino te conoce" y "Últimos 7 días" — datos accionables

> **🔧** `DECISIONS.md` §1.4 — correlación = **ratio simple, no Pearson**. Guard duro ≥14 días. Query dentro del payload del dashboard (un round-trip). Frase dinámica armada en backend (§0.10).

**"Kino te conoce" → Frase dinámica contextual:**
- No: *"Rindes mejor entre 18h y 20h · cronotipo evening"* (dato estático).
- Sí: *"Son las 14h. Tu pico empieza en 4h. Ahora: tareas de energía media."*
- Barra de personalización 33% → tooltip: *"Cuantos más check-ins registres, más precisa será la predicción. ~15 días para calibración completa."*
- Si alpha < 50%: CTA inline *"Registra tu energía hoy para mejorar →"* que scrollea a `EnergyBatteryCard`.

**"Últimos 7 días" → Correlación, no solo datos:**
- Añadir capa de correlación: *"Los días que registraste energía completaste 2.3× más tareas."*
- **Solo se muestra si hay ≥14 días de historial** (tareas completadas + checkins). Con menos data: *"Con más check-ins, Kino aprenderá cuándo rendís mejor."* Sin valores de correlación hardcodeados.
- `correlationFactor` es una query nueva en el backend (no en el cliente). Cruza tareas completadas por día con días que tuvieron checkin. Se ejecuta en el endpoint del dashboard.
- Si correlación positiva: refuerza el hábito del check-in.

**Ambas secciones van colapsadas si hay tareas pendientes en el plan.** El plan tiene prioridad visual.

---

#### 1.5 EnergyAdvisorBanner — componente reutilizable

> **🔧** `DECISIONS.md` §1.5 — presentacional + hook `useEnergyAdvisor()`. Props `{ message, icon, action? }`. Columna activa en `TaskActionView` la decide el backend, no el cliente.

- Extraer desde `getTodayAdvisor(userId)` (ya existe, solo usado en `dashboard/page.tsx`).
- Componente `EnergyAdvisorBanner`: una línea, icono de energía, texto contextual + acción inline.
- Aparece en: dashboard (panel derecho), `/systems/[id]` (encima de tabs), `/tasks` (encima de la lista).
- En `TaskActionView`: resaltar con ring/badge la columna activa (High/Medium/Low) según `projectedCurve` + hora actual.
- **Nota de ejecución**: este componente (1.5) debe estar completo antes de iniciar Fase 2, ya que `/tasks` lo consume.

---

### Fase 2 — Vista `/tasks`: Smart Daily Focus

**Depende de**: Fase 0.5.
**Ataca**: C6 — `/tasks` hoy es un grid ilegible sin identidad clara.

**Qué ES `/tasks`**: el cerebro de Kino. Una vista donde la app te dice *qué deberías hacer hoy* basándose en urgencia + salud de sistemas + energía disponible. No es tu plan comprometido (eso es el Dashboard) — es la recomendación proactiva de Kino.

**Nota de system_type**: los filtros (panel de filtros) muestran estados dinámicos según qué systems ves. Si ves solo `academic`, el filtro de estado muestra `studying | draft | submitted | feedback | done`. Si mezclas `academic + professional`, muestra la unión de estados válidos.

> **🔧 Decisiones de ingeniería (Fase 2)**: `DECISIONS.md` §2.1, §2.1.b, §2.2. Globales clave: §0.1 (TanStack Query), §0.5/§0.10 (scoring en backend), §0.6 (fechas).

---

#### 2.1 Plan sugerido por Kino — la vista principal

> **🔧** `DECISIONS.md` §2.1 — fórmula determinista de `score()` con pesos exactos (vencidas → prioridad → due-soon → energy match → age). §2.1.b — caché 1×/día con `useRef`+dateKey, completar sube la siguiente de las 10 ya cargadas sin nuevo fetch.

Al entrar a `/tasks` por primera vez en el día, Kino genera automáticamente un plan recomendado. Se cachea en estado React local — no se regenera automáticamente durante la sesión. Botón `[Regenerar sugerencias]` para forzar un nuevo cálculo. Al día siguiente, fresh run al primer load.

**Algoritmo del plan sugerido** (`insights.service.getSuggestedTasks` — ya existe, hoy no se usa en UI):
1. Si no hay checkin del slot actual del día, `energyLevel` = valor predicho de `projectedCurve` para la hora actual.
2. Prioriza por: tareas vencidas primero → prioridad crítica/alta → energía compatible con la hora actual.
3. Muestra entre 3 y 7 tareas (no abruma). El endpoint devuelve hasta 10 candidatas; la UI muestra las primeras 3-7.
4. Al migrar status (Fase 4), actualizar el filtro de `getSuggestedTasks` de `['today', 'tomorrow', 'week']` a `['action']`.

**Diseño de la vista:**
```
┌─ Tasks ──────────────────────────────────────────────────┐
│  Kino sugiere para hoy · basado en tu energía y urgencia  │
│  ─────────────────────────────────────────────────────── │
│  ● Preparar diapositivas ConoceRD     HIGH  hoy  ~30min  │
│  ● QA ajustes finales                CRIT  Jun3  ~1h     │
│  ● Leer Meditaciones de Marco Aurelio MED   ─    ~45min  │
│                                                           │
│  [+ Agregar al plan de hoy]  [Ver todas las tareas ↓]   │
│  ─────────────────────────────────────────────────────── │
│  Todas las tareas                    [🔍] [Filtros] [≡⊞] │
│  ...lista completa con filtros...                        │
└──────────────────────────────────────────────────────────┘
```

**Quest mode en `/tasks`:**
- Botón "Trabajar en esto ahora" en cada tarea del plan sugerido → inicia el focus timer sin salir.
- Las tareas del plan sugerido se pueden: marcar completadas, mover al plan de hoy del dashboard. Sin botón de "descartar" — el usuario ignora o mueve.
- Al completar una tarea del plan sugerido → Kino sube la siguiente de la lista ya cargada, sin nueva llamada al endpoint. El endpoint devuelve hasta 10 candidatas; la UI muestra las primeras 3-7.
- `[+ Agregar al plan de hoy]` → activa `in_today_plan = true` en las tareas sugeridas seleccionadas. Desaparecen de las sugerencias — ya están en el plan del Dashboard. No modifica `dueDate`.

**"Plan para hoy" dentro de `/tasks` (diferente al Planning semanal):**
- Sección colapsable encima de "Todas las tareas".
- El usuario puede agregar/quitar tareas de este plan de hoy (mismas tareas con `dueDate = CURRENT_DATE` que el dashboard).
- Es la misma data que el Dashboard Plan de hoy — son dos vistas del mismo plan, no dos planes distintos.

---

#### 2.2 Lista completa con filtros y legibilidad

> **🔧** `DECISIONS.md` §2.2 — filtros en URL CSV (`?status=a,b`), helpers en `lib/taskFilters.ts`, filtrado/orden/agrupado **client-side** con mapas `SORTERS`/`GROUPERS`. Sin virtualización por ahora (solo si >200 filas rutinarias).

**Vista lista como default** (no grid). Cada fila muestra el título completo:
```
[☐] Escribir mis valores fundamentales          backlog  HIGH  Personal  ─
[☐] Desarrollo: Home, About y sistema de diseño backlog  HIGH  ConoceRD  May 31 ⚠
[☐] Preparar diapositiva y contenido ConoceRD   action   HIGH  ConoceRD  hoy
```

Toggle lista/grid/board en el header (iconos). El grid usa altura mínima de 2 líneas para el título.

**Panel de filtros:**
- `Sistema`: multiselect coloreado.
- `Estado`: backlog · planning · action · done.
- `Prioridad`: low · medium · high · critical.
- `Energía requerida`: low · medium · high.
- `Tipo`: task · idea · event · reminder · habit.
- `Fecha`: sin fecha · con fecha · vencidas · próximos 7 días.
- `Agrupar por`: sistema · estado · prioridad · energía.
- `Ordenar por`: prioridad · fecha límite · energía · creación.
- Filtros aplicados → chips removibles.
- Estado de filtros persiste en URL (query params, `useSearchParams` nativo).

**Comportamiento:**
- Contador: *"42 tareas · 3 filtros activos"*.
- Tareas vencidas: borde izquierdo rojo + badge, no solo texto rojo.
- Al completar desde esta vista: animación de salida suave (no desaparece instantáneamente).

---

### Fase 3 — Formulario y tipos de tarea (consciente de system_type)

**Depende de**: Fase 0.5.
**Ataca**: C8, A3, A6.

> **🔧 Decisiones de ingeniería (Fase 3)**: `DECISIONS.md` §3.1, §3.2, §3.3. Globales clave: §0.3 (Zod compartido, discriminated union), §0.4 (react-hook-form + zodResolver).

---

#### 3.1 Formulario progresivo de 3 pasos (CreateTaskDialog), dinámico por system_type

> **🔧** `DECISIONS.md` §3.1 — **un solo form** RHF, pasos = render condicional, avance con `form.trigger(STEP_FIELDS[step])`. Memoria de paso: contexto explícito (sistema) > memoria. Campos adicionales varían por `system.type`.

Los campos de una tarea tienen 3 momentos naturales:

| Paso | Cuándo | Campos |
|------|--------|--------|
| 1 — Captura | Ahora, en 2 segundos | Título + Sistema |
| 2 — Planificación | Al organizar la semana | Energía · Prioridad · Tipo · Fecha inicio · Fecha límite · Estimated time |
| 3 — Detalle | Al empezar la tarea | Notas · Subtareas · Recordatorios · Context tags |

**Implementación:**
- Dialog modal centrado (no Sheet — la Sheet es para editar).
- Tres dots de progreso en el header.
- `Tab` / `Enter` avanza al siguiente paso. `Esc` descarta.
- Botón "Guardar" disponible desde el Paso 1.
- El dialog arranca en Paso 1 siempre. Si se abre desde QuickAdd global (sin contexto de sistema), recuerda el último paso activo (estado React local, se resetea al cerrar). **Regla de apertura: contexto explícito (sistema) > memoria del paso.**

**Smart defaults al crear:**
- Dentro de un sistema → sistema preseleccionado.
- Hora de pico según curva → default energy = high.
- Si tipo = `idea` → status = backlog forzado, Paso 2 oculta fechas.
- Si tipo = `event` → Paso 2 abre date picker inmediatamente, campo fecha requerido.
- Si tipo = `reminder` → Paso 2 solo muestra fecha (sin energía ni prioridad).

**TaskDetailSheet** (edición): mantiene todos los campos en vista única vertical, organizados por las mismas 3 secciones con divisores visuales. No cambia de estructura, solo se limpia y agrupa.

**Campos adicionales por system_type** (Paso 2, sección "Planificación"):

| System Type | Campos extra |
|-------------|-------------|
| `academic` | `course`, `professor`, `syllabus` (URL), `collaborators` (multiselect usuarios) |
| `professional` | `project`, `assignee`, `dependencies` (link a otras tareas), `reviewer` |
| `entrepreneurial` | `milestone`, `kpi` (métrica de éxito), `hypothesis` (qué creemos que pasa) |
| `personal` | `why` (por qué importa), `recurrence` (futuro: RRULE) |
| `custom` | Campos definidos por el usuario en la configuración del sistema |
| `inbox` | Ninguno — captura mínima |

**Smart defaults al crear (por system_type)**:
- `academic`: `energy = medium`, `type = 'task'`
- `professional`: `energy = high`, `priority = high`, `type = 'task'`
- `entrepreneurial`: `energy = high`, `priority = critical`, `type = 'task'`
- `personal`: `energy = flexible`, `type = 'task'`

---

#### 3.2 EstimatedTime — pill selector

> **🔧** `DECISIONS.md` §3.2 — `ToggleGroup` shadcn single-select en minutos, "3h+" abre Popover, controlado por RHF `Controller`. Sin cambio de schema.

Reemplaza el `<input type="number">`:

```
[  15m  ] [  30m  ] [  1h   ] [  2h   ] [ 3h+  ] [  —  ]
```

- Internamente sigue siendo entero en minutos (sin cambio de schema).
- "3h+" despliega opciones: 3h / 4h / 5h / personalizado.
- "—" = null (sin estimación).
- En TaskCard y en la lista: si tiene estimación, muestra `~30m` junto al timer.
- El valor es el que usa el Pomodoro para el countdown.

---

#### 3.3 task_type con comportamiento real

> **🔧** `DECISIONS.md` §3.3 — **patrón clave**: `TASK_TYPE_CONFIG` (un solo objeto fuente de verdad para icono/defaultStatus/requiredFields/hidden), consumido por form, card y validación. Validación por tipo = `z.discriminatedUnion('type', ...)`. **No** `if` dispersos.

| Tipo | Comportamiento frontend | Comportamiento backend |
|------|------------------------|------------------------|
| `task` | Sin cambio | Sin cambio |
| `idea` | Icono 💡 · Grupo "Ideas" separado en lista · Sin urgencia visual (sin rojo overdue) | `status = 'backlog'` forzado al crear · Sin validación de `dueDate` requerida · Endpoint "Promover a tarea" (cambia `type` → task, habilita todos los campos) |
| `event` | Icono 📅 · En Planning se ve como bloque de día, no chip · Badge con hora · No aparece en Action | `startDate` requerida para guardar · `status` auto-mueve a `done` cuando `startDate` pasa |
| `reminder` | Icono 🔔 · Visual minimalista (solo título + fecha) · Sin energy/priority visible | Solo requiere título + `dueDate` · Crea automáticamente un `taskReminder` |
| `habit` | Icono 🔁 · Visual distinto · **Sin streak hasta que exista recurrencia** | Sin lógica especial por ahora. Futuro: conectar con recurrencia |

**Schema**: sin columnas nuevas. El `taskTypeEnum` ya existe. Cambios en `tasks.service.ts` y `TaskCard.tsx`.

---

### Fase 4 — Vistas dinámicas por system_type (reemplaza el funnel global)

**Depende de**: Fase 0.5.
**Ataca**: A2 (system_type sin efecto), A4, A5 — funnel genérico que no sirve a nadie.

**El cambio radical**: `/systems/[id]` no es una vista fija. Es **5 vistas completamente distintas**, una por system_type.

> **🔧 Decisiones de ingeniería (Fase 4)**: `DECISIONS.md` §4 (refactorizado). Globales clave: §0.2 (optimistic), §0.3 (Zod `.superRefine`), §0.6 (fechas).

**Arquitectura**:
- `SystemDetailView.tsx` es un router que elige la vista basado en `system.type`:
  ```typescript
  const view = {
    academic: <SystemAcademicView />,
    professional: <SystemProfessionalView />,
    entrepreneurial: <SystemEntrepreneurialView />,
    personal: <SystemPersonalView />,
    custom: <SystemCustomView />,
  }[system.type]
  ```
- Cada vista es su propio componente con su propia lógica, estados, UI.
- **Reutilización**: todas comparten `TaskCard` adaptativo (que cambia por system_type), validadores comunes, providers.

---

#### 4.1 SystemAcademicView — Timeline de entregas

**Vista principal**: Calendario semanal horizontal (similar a Google Calendar).

**Componentes**:
- **Timeline**: semanas de enero a junio. Cada entrega es un bloque visual con:
  - Título de tarea
  - Materia/curso
  - Profesor (hover)
  - Fecha de entrega
  - Botón quick-add para subtareas (apuntes, preguntas)
- **Panel lateral**: tareas sin fecha (`backlog = true`). Arrastra a la timeline para asignar `dueDate`.
- **Estados**: `idea | studying | draft | submitted | feedback | done`.

**Interacciones**:
- Click en bloque → `TaskDetailSheet` con campos `course`, `professor`, `syllabus`, `collaborators`.
- Arrastra bloque → cambia `dueDate`.
- "→ Esta semana": asigna `startDate = lunes semana actual` (igual que otros tipos).
- Multi-checkin de energía: refuerza estudiar en franjas de energía media/alta.

**Empty states**:
- Sin tareas: *"Importa tu syllabus o agrega entregas manualmente. → Crear tarea"*
- Sin entregas esta semana: *"Semana libre — momento para adelantar o descansar."*

---

#### 4.2 SystemProfessionalView — Kanban de proyectos

**Vista principal**: Kanban con columnas = estados (`backlog | planned | in-progress | blocked | review | done`).

**Componentes**:
- **Columnas**: cada una representa un estado. Cards en cada columna muestran:
  - Título + asignado a (si no eres tú, color diferente)
  - Proyecto (chip coloreado)
  - Prioridad (badge: critical/high/medium/low)
  - Bloqueadores (icono si está bloqueado)
  - Reviewer (si está en review, avatar)
- **Panel derecho (colapsable)**: estadísticas semanales (velocity, WIP limit, tareas por asignado).
- **Quick-add en cada columna**: botón `+` para agregar tarea a ese estado.

**Interacciones**:
- Drag-and-drop entre columnas → muta `status` automáticamente.
- Click en card → `TaskDetailSheet` con `project`, `assignee`, `dependencies`, `reviewer`.
- Mostrar bloqueadores: si una tarea está en `blocked`, tooltip muestra qué la bloquea.
- Notificación de bloqueadores: si >2 tareas bloqueando a otras, banner en top.

**Empty states**:
- Sin tareas en `in-progress`: *"¿Hoy qué priorizas? Arrastra desde Planned."*
- Sin tareas en `blocked`: *"Sin bloqueadores — flujo limpio."*

---

#### 4.3 SystemEntrepreneurialView — Progress hacia milestones

**Vista principal**: Milestones como filas. Tareas como sub-items dentro de cada milestone.

**Componentes**:
- **Milestone header**: nombre + fecha objetivo + progreso (X/Y tareas) + KPI (si hay).
  ```
  🎯 MVP lanzado — Jun 15
  12/15 tareas · KPI: 1000 signups
  ████████░░ 80%
  ```
- **Subtareas bajo milestone**:
  - Estado: `idea | validating | building | launched | scaling | done`
  - Hipótesis mostrada en tooltip: *"Creemos que [X] resulta en [Y]"*
  - Learnings (una vez completada): *"Aprendimos que [Z]"* (campo adicional)
- **Columna de velocidad**: sparkline de tareas completadas por semana.

**Interacciones**:
- Click en milestone → expande/colapsa.
- Drag tarea → reordena dentro del milestone (para prioridad).
- Click en tarea → `TaskDetailSheet` con `milestone`, `hypothesis`, `learnings`, `kpi`.
- "Completada": prompt de learnings → *"¿Qué aprendiste?"*

**Empty states**:
- Sin milestones: *"Crea el primer milestone de tu startup. → Nuevo milestone"*
- Milestone sin tareas: *"Ninguna tarea aún. → Agregar."*

---

#### 4.4 SystemPersonalView — Lista flexible + recurrencia

**Vista principal**: Lista simple (no kanban, no timeline). Agrupable por prioridad/energía/fecha.

**Componentes**:
- **Filtros rápidos**: [Activos] [Pausados] [Ideas] [Completados hoy].
- **Agrupar por**: prioridad, energía requerida, recurrencia, fecha.
- **Cada tarea muestra**:
  - Checkbox (prominente) + título
  - `why` (por qué importa) en subtítulo gris
  - Energía requerida (dot coloreado)
  - Recurrencia (icono 🔁 si aplica)
  - Última vez que la completaste (gris pequeño)
- **Modo vista**: list / grid compacto.

**Interacciones**:
- Click → tarea se marca completa (animación de tachado).
- Hover → botones: editar, enfocar, snooze (pausar 1 día).
- Quick-complete: marcar varios en fila.
- Post-completion: *"Buen trabajo. ¿Cómo fue?"* → prompt de reflexión + energía.

**Empty states**:
- Sin tareas: *"Empieza tu día. → Crear tarea rápida"*
- Todas completadas: *"¡Hiciste todo! Celebra."* + confeti.

---

#### 4.5 SystemCustomView — Configurador y lienzo del usuario

**Para `system_type = 'custom'`**: el usuario define todo.

**Componentes**:
- **Settings tab**: (accesible sin salir)
  - Nombre del sistema
  - Estados custom: agregar/remover/reordenar (drag). Cada estado tiene: nombre, emoji, color.
  - Campos custom: agregar campos (p. ej. "Rol", "Equipo", "Enlace QA").
  - Vista preferida: elegir entre timeline, kanban, list, progress.
- **Área principal**: renderiza la vista elegida pero con estados/campos custom.

**Ejemplo de custom system**:
```
Nombre: "Side project — Blog"
Estados: Planning | Writing | Editing | Published | Archived
Campos: Topic, Keywords, Word count, External links
Vista: List
```

**Empty states**:
- Sin estados: *"Define los estados de tu sistema primero."* → link a settings.

---

#### 4.6 Validaciones de coherencia (todas las vistas)

> **🔧** `DECISIONS.md` §4.6 — Zod `.superRefine()` con reglas específicas por type.

**Reglas globales** (aplican a todos los types):
- `dueDate < startDate` → error de validación, no se guarda.
- `type = 'event'` sin `startDate` → error de validación.
- `type = 'reminder'` sin `dueDate` → error de validación.

**Reglas por type**:
- **academic**: `dueDate` requerida para entregar. Warning si `startDate > dueDate - 3 days` (poco tiempo de preparación).
- **professional**: `assignee` requerida si está en `in-progress`. Warning si `blocked` sin asignar bloqueador explícito.
- **entrepreneurial**: `milestone` requerida. Warning si `launching | scaling` sin `hypothesis` completada.
- **personal**: sin validaciones estrictas (flexible).

**Warnings** (no impiden guardar, solo avisos visuales):
- `dueDate = hoy` con `startDate > hoy` → warning en TaskDetailSheet.
- Tarea `paused` >30 días → nudge: *"¿Cancelamos esta?"*

---

#### 4.7 TaskCard adaptativo

**Un solo componente** `<TaskCard>` que cambia por `system.type`:

```typescript
// Dependiendo de system.type:
academic: mostrá course, professor, estado de estudios
professional: mostrá assignee, project, bloqueadores
entrepreneurial: mostrá milestone, hypothesis, KPI
personal: mostrá why, recurrence, reflexión post-completada
custom: mostrá campos custom del sistema
```

Reutiliza:
- Lógica de optimistic updates
- Estilos base (padding, border, shadow)
- Interacciones (click, drag, quick-complete)

**Cambios visuales por type**:
- Color de fondo (según `system.type`)
- Icono y emoji del type
- Campos visibles
- Botones de acción (algunos types no muestran "snooze", otros sí)

---

#### 4.8 Migraciones de datos (Fase 4)

**Cambio de status enum (Fase 0.5, pero completado aquí)**:
- Migración SQL: cambiar tipo de `tasks.status` a VARCHAR en todas las vistas.
- Backfill: si hay tasks con `planning` (fue removido en Fase 0), cambiar a `backlog`.
- Migración Drizzle: reflejar cambio de schema.

**Si hay systems existentes sin type**:
- Script: asigna `type = 'personal'` a todos (default).
- UI de bienvenida: pide al usuario elegir el type real de cada sistema la próxima vez que lo abre.

---

### Fase 5 — Timer: Pomodoro real integrado con energía

**Depende de**: Fases 3-4 estabilizadas.
**Ataca**: C7, A8.

> **🔧 Decisiones de ingeniería (Fase 5)**: `DECISIONS.md` §5.1, §5.2. Globales clave: §0.2 (optimistic), §0.7 (sonner toast persistente), §0.9 (sparkline Recharts).

---

#### 5.1 Focus timer → Pomodoro con propósito

> **🔧** `DECISIONS.md` §5.1 — **motor por timestamps, no contador decreciente** (evita drift en background). Máquina de estados con `useReducer`. `FocusTimerProvider` (Context) en root para cross-route. `playTimerChime()` Web Audio (código exacto). Session recap = upsert del checkin del slot. **Gotcha**: `AudioContext` necesita gesto del usuario — crearlo en el click de "Enfocarme".

**Punto de entrada — visible y explícito:**
- `TaskCard` en Action tab: botón **▶ Enfocarme** visible (no en hover, siempre visible en mobile).
- `TodayPlanCard` en dashboard: mismo botón por tarea.
- `/tasks` plan sugerido: botón "Trabajar en esto ahora".

**Modal de selección de modo al iniciar:**
- **Pomodoro** (25 min trabajo · 5 min descanso).
- **Estimado** (cuenta regresiva según `estimatedDuration` de la tarea). Si no tiene estimación → abre pill selector antes de empezar.
- **Libre** (cronómetro al alza).

**Durante la sesión (FocusTimerWidget rediseñado):**
- Nombre de la tarea activa visible.
- Tiempo restante/transcurrido prominente.
- Modo activo.
- **Auto-stop** al llegar a 0: tono sintetizado (Web Audio API) + widget cambia a estado "tiempo agotado" con CTA. Notificación push al expirar el timer = roadmap futuro.
- **Descanso automático** en Pomodoro: al terminar bloque de trabajo → contador de descanso arranca solo.
- Botón "Completar tarea" en el widget.

**Session recap (al parar o completar):**
Toast persistente (no desaparece solo, no bloquea el flujo):
> *Trabajaste 27 min en "Preparar diapositivas". ¿Cómo fue tu energía?*
> `🔥 Alta` · `⚡ Media` · `🌙 Baja`

- La respuesta actualiza (upsert) el checkin del slot activo actual — si no existe, lo crea; si existe, actualiza `currentLevel`. Alimenta `learningAlpha` vía `calibrateLearnedCurve`.
- Si tenía estimación: *"Estimaste 30 min, trabajaste 27 — ¡Buen ojo!"*
- Si `tiempoReal > estimado * 1.5`: *"Estimaste 15 min, trabajaste 45 min"* → Kino aprende que este tipo toma más tiempo.

**Integración con predicciones:**
- `timeLogs` con `energyLevel` post-focus → `energy.service.calibrateLearnedCurve()`.
- Hora del día de las sesiones → refuerza o corrige el cronotipo detectado.
- Resultado acumulativo: con ~2 semanas de uso, la curva predicha converge a la real sin que el usuario haga nada extra.

---

#### 5.2 Visibilidad de tiempo acumulado

> **🔧** `DECISIONS.md` §5.2 — suma agregada `SUM(durationSeconds)`/`COUNT`, helper `formatDuration`. Sparkline = Recharts mini sin ejes. `getTopPattern`: implementar query real (timeLogs × checkins por slot, mayor `completed/hora` = pico real).

- `TaskDetailSheet` → sección "Tiempo registrado": suma de `timeLogs` de esa tarea → *"3h 20min en total · 4 sesiones"*.
- `/systems/[id]` → panel colapsable "Tiempo esta semana": top 5 tareas por tiempo + sparkline de `systemHealth`.
- Settings/Perfil → curva de energía aprendida vs. genérica + patrones detectados. **Nota**: `getTopPattern` hoy es un alias de `getTodayAdvisor` — requiere implementar una query real que cruce `timeLogs` + `energyCheckins` para detectar franjas horarias de mayor productividad. Implementar como parte de esta fase.

---

### Fase 6 — Inteligencia contextual: system_type

**Depende de**: Fase 4 (funnel estable).
**Ataca**: A2 — `system_type` es decorativo.

> **🔧 Decisiones de ingeniería (Fase 6)**: `DECISIONS.md` §6.1 — **mismo patrón que 3.3**: `SYSTEM_TYPE_CONFIG` (un solo objeto: defaultTaskEnergy, schedulingPreference, advisorTemplate, defaultIcon). `energy.planner.ts` lee `schedulingPreference`, no nombres. `getSystemHealthIndicator` query nueva. Sin columnas nuevas.

---

#### 6.1 system_type con comportamiento real

| Aspecto | Comportamiento |
|---------|---------------|
| **Task defaults** | Al crear tarea en sistema `work` → default energy = high; `health` → low; `creative` → medium; `learning` → medium |
| **Scheduling** | `energy.planner.ts`: sistemas `health` en slots de energía baja; `creative` en pico; `work` en alto/medio |
| **Advisor awareness** | Mensajes type-aware con estos templates: `work`: *"{nombre} lleva {n} días sin actividad — estás en tu ventana de alta energía."* · `health`: *"Momentos de baja energía son perfectos para {nombre}."* · `creative`: *"{nombre} espera hace {n} días. Ahora estás en pico — ¿saltás?"* · `learning`: *"Energía media — ideal para avanzar en {nombre}."* · stale genérico: *"{n} días desde última tarea en {nombre}."* |
| **systemHealth stale** | Badge en sidebar: si `expectedFrequency = daily` y `systemHealth.date` tiene >2 días → indicador "stale" visible en `SystemTreeItem` |
| **Icono por defecto** | Si el usuario no eligió icono, se asigna uno predeterminado por `system_type` |

**Backend:**
- `systems.service.ts`: añadir `getSystemHealthIndicator(systemId)` usando `systemHealth` + `expectedFrequency`.
- `trigger_context` y `description`: mostrarlos en `SystemDetailHeader` como texto colapsable (visibles para el usuario, no solo metadatos para MCP).
- Sin columnas nuevas.

---

## Fuera de alcance — Roadmap futuro

Se documentan en `docs/STATUS.md` como roadmap. Schema intacto.

- **Recurrencia (RRULE)**: columnas + state-machine parcial. Sin UI. Habilita `habit` streak completo cuando esté.
- **Integración Asana/Linear (professional)**: OAuth + sync bidireccional de tareas.
- **Integración Google Classroom (academic)**: importar syllabus + entregas.
- **Billing / Premium / Lemon Squeezy**: sin código.
- **Sync adapters**: `syncConnections` en schema, sin implementación.
- **Gamificación** (`quests`, `inventoryItems`): en schema, concepción RPG.
- **Editor de bloques tipo Notion**: TipTap StarterKit hoy. Slash commands, bloques, tablas, embeds.
- **Landing page y documentación pública**.
- **`context_tags` con UI de gestión**: existen en schema, sin pantalla.
- **Streak de habits**: depende de recurrencia.
- **Validadores custom** en sistemas custom: permite el usuario agregar reglas de validación personalizadas.
- **Notificaciones push** según system_type: academic notifica entregas, professional notifica bloqueadores, etc.

---

## Orden de implementación

```
Fase 0 (honestidad repo)
│
├── Fase 0.5 (NUEVA) ← BLOQUEANTE: arquitectura de system_type
│     ├── 0.5.1 Schema flexible (status VARCHAR + tabla de validación)
│     ├── 0.5.2 SYSTEM_TYPE_CONFIG centralizado
│     ├── 0.5.3 Providers y utilities
│     └── 0.5.4 Migrations de datos
│
├── Fase 1 (dashboard, agnóstico a system_type en UI)
│     ├── 1.1 Layout sin scroll (estructura CSS)
│     ├── 1.2 Plan de hoy interactivo (quest + descanso desde backend)
│     ├── 1.3 Gráfica energía + multi-checkin + feedback
│     ├── 1.4 Kino te conoce / 7 días accionables
│     └── 1.5 EnergyAdvisorBanner (componente compartido)
│
├── Fase 2 (/tasks smart focus, filtros adaptativos)
│     ├── 2.1 Plan sugerido por Kino + quest mode
│     └── 2.2 Lista con filtros dinámicos por system_type
│
├── Fase 3 (formulario dinámico + tipos)
│     ├── 3.1 CreateTaskDialog progresivo (campos varían por type)
│     ├── 3.2 EstimatedTime pill selector
│     └── 3.3 task_type con comportamiento real
│
├── Fase 4 (REESCRITA COMPLETA) — Vistas dinámicas por system_type
│     ├── 4.1 SystemAcademicView (Timeline)
│     ├── 4.2 SystemProfessionalView (Kanban)
│     ├── 4.3 SystemEntrepreneurialView (Progress/Milestone)
│     ├── 4.4 SystemPersonalView (Lista flexible)
│     ├── 4.5 SystemCustomView (Configurador)
│     ├── 4.6 Validaciones de coherencia (por type)
│     ├── 4.7 TaskCard adaptativo
│     └── 4.8 Migraciones de datos
│
├── Fase 5 (timer + energía)
│     ├── 5.1 Pomodoro real + auto-stop + session recap
│     └── 5.2 Visibilidad tiempo acumulado
│
└── Fase 6 (extensiones opcionales)
      ├── 6.1 System custom avanzado (validadores custom, etc.)
      └── 6.2 Integraciones con cada system_type (Google Classroom para academic, Asana sync para professional, etc.)
```

**Dependencias críticas**:
- **Fase 0.5 es bloqueante**: Fases 1-4 dependen de ella.
- **Fase 1 y 2** pueden correr en paralelo tras 0.5.
- **Fase 3** puede empezar en paralelo con 1, pero se completa antes de Fase 4.
- **Fase 4 depende de 0.5 + 3** (necesita form y esquema listos).
- **Fase 5 depende de 3-4** (timer necesita timer-aware tasks).
- **Fase 6** es opcional y decorativa.

---

## Mobile: layout por fase

**Patrón por defecto** (aplica a toda fase salvo excepción explícita): en `md` breakpoint y menor, todo se apila en columna única. BottomNav siempre visible. Sin split panels. Cards ocupan el ancho completo.

| Fase | Comportamiento mobile específico |
|------|----------------------------------|
| **1.1 Dashboard** | Panel derecho (energía + advisor) se apila debajo del Plan de hoy. Fila inferior (stats / Kino te conoce / 7 días) se convierte en un carrusel horizontal de cards compactas. |
| **1.2 Plan de hoy** | Sin cambio de estructura — la card ocupa pantalla completa y es scrollable. Botones de acción por tarea (completar, timer, mover a mañana) visibles siempre, no solo en hover. |
| **1.3 Energía** | La gráfica se muestra en formato compacto (altura reducida). El botón "Registrar energía" es prominente, botón de feedback de predicción debajo. |
| **2.1 /tasks plan sugerido** | Lista vertical, cada tarea ocupa el ancho completo. Botón "Trabajar en esto ahora" siempre visible (no en hover). |
| **2.2 Filtros** | Panel de filtros: bottom sheet (no sidebar). Botón `[Filtros]` en el header abre la sheet desde abajo. |
| **3.1 CreateTaskDialog** | Dialog ocupa ~95% del viewport. Los 3 pasos se navegan con botones full-width. |
| **4.1 Academic Timeline** | Scroll horizontal semanas. Bloques de entrega ocupan ancho completo, se apilan verticalmente por día. |
| **4.2 Professional Kanban** | Scroll horizontal columnas. Una columna visible a la vez. Drag-and-drop funciona con touch (ya soportado por `@dnd-kit`). |
| **4.3 Entrepreneurial Progress** | Milestones con collapse/expand. Subtareas anidadas. Scroll vertical. |
| **4.4 Personal List** | Lista simple, full-width. Botones de acción en hover → swipe para revelar (iOS) o tap-and-hold. |
| **4.5 Custom View** | Adapta al layout elegido por el usuario. |
| **5.1 Timer** | `FocusTimerWidget` se ancla encima del BottomNav como banner persistente cuando hay sesión activa. Al expandirlo: modal full-screen con el tiempo prominente. |

---

## Convenciones

- Branch: `feat/` o `fix/` + slug por fase/item.
- Commits: Conventional Commits sin `Co-Authored-By`.
- Antes de cada PR: `pnpm typecheck && pnpm lint && pnpm build`.
- Mobile: cada cambio se prueba en `md` breakpoint con `BottomNav`.
- Seguridad: `userId` siempre de sesión. Zod en todos los inputs.
- Schema: antes de cualquier columna nueva, verificar contra SADD arc42.
