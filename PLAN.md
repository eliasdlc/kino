# PLAN — Planificador Diario Consciente de Energía

> Estado: **Crawl ✅ completado** — Walk en curso.
> Última actualización: 2026-05-20.
> **Este documento es autocontenido**: asume que el lector (humano o IA) no presenció la
> conversación de diseño. El historial completo de cómo se llegó aquí está en `DISCOVERY.md`.

## 0. Contexto del proyecto (leer primero)

**Kino** es una plataforma de productividad construida alrededor de la **gestión de energía
cognitiva** y los **sistemas basados en identidad**. Desarrollador único: Elías. Las explicaciones
y docs van en **español**; el código, nombres de variables, tipos, columnas y archivos en
**inglés**.

### Stack (las versiones importan)
- **Framework**: Next.js 16 (App Router, API Routes, Server Actions). 100% Serverless.
- **Lenguaje**: TypeScript strict (prohibido `any`, prohibidos type assertions sin justificación).
- **ORM**: Drizzle (NO Prisma) — elegido por soporte nativo de extensiones PostgreSQL.
- **DB**: PostgreSQL 15 (Railway) con extensiones `uuid-ossp` y `ltree`.
- **Auth**: Better Auth — sesiones stateful en PostgreSQL, cookies HttpOnly, **sin JWT**.
- **Estado**: TanStack Query v5 (estado de servidor) + Zustand (estado de UI).
- **Estilos**: Tailwind CSS + shadcn/ui (primitivos Radix).
- **Jobs en background**: Lazy Evaluation (catch-up al login) + Vercel Cron. **Sin Redis, sin
  colas, sin servidor persistente, sin WebSockets.**
- **Pagos**: Lemon Squeezy. **Email**: Resend. **Storage**: Cloudflare R2.
- **Package manager**: pnpm.

### Restricciones duras (no violar)
1. **$0/mes de infra**: todo dentro de free tiers (Vercel + Railway + Cloudflare R2).
2. **Límite de 10s** en funciones Serverless (free tier): paginar operaciones pesadas.
3. **Sin tiempo real por WebSocket**: usar polling de TanStack Query (`refetchInterval` + `invalidateQueries`).
4. `system_id` es **NOT NULL** en tareas: toda tarea pertenece a un sistema; el **Inbox**
   (`is_inbox=true`) es el default. No hay tareas flotantes.
5. **Timestamps en UTC** (TIMESTAMPTZ). Las columnas `DATE` (ej. `due_date`) son fechas lógicas en
   la zona del usuario (excepción documentada).
6. **Soft delete** para tasks y pages (`deleted_at`): filtrar siempre `WHERE deleted_at IS NULL`.

### Convenciones de código
- **Vertical Slices**: cada feature en `src/features/{feature}/` es autocontenida con sus archivos
  `*.routes.ts`, `*.service.ts`, `*.queries.ts`, `*.schemas.ts`, `*.types.ts`. **No** importar
  internals de otro slice; comunicarse por interfaces compartidas.
- **Schema único**: todo el schema Drizzle vive en `src/shared/db/schema.ts` (única fuente de verdad).
- Toda API route: (1) valida sesión vía Better Auth y toma `user_id` de la **sesión, nunca del
  body**; (2) valida input con **Zod**; (3) filtra todas las queries por `user_id` (aislamiento por
  fila a nivel app); (4) devuelve errores con forma `{ code, message, details? }`.
- **UI optimista** (TanStack Query): `onMutate` (cache con ID temporal) → `onSuccess` (reemplaza con
  UUID del servidor) → `onError` (rollback + toast).
- **ltree** requiere SQL crudo (`sql` tagged template) para operadores `<@`, `@>`, `~`, `nlevel()`.
- Endpoints Premium llevan guard de suscripción. Rutas de cron verifican header `CRON_SECRET`.

### Estado actual del código relevante (lo que existe HOY)
Esto fue verificado leyendo el repo; un lector sin contexto debe saberlo para no re-derivarlo:

- **Tabla `tasks`** (`src/shared/db/schema.ts`, ~líneas 380–450). Columnas relevantes:
  `status` (enum: `backlog`/`week`/`tomorrow`/`today`/`done`/`archived`),
  `energyLevel` (enum: `high`/`medium`/`low`, NOT NULL default `medium`),
  `priority` (enum: `critical`/`high`/`medium`/`low`),
  `taskType` (enum nullable: `idea`/`reminder`/`project`/`todo`),
  `dueDate` (date), `startDate` (date), `estimatedTime` (time),
  `recurrenceRule`, `parentTaskId` (subtareas), `folderId`, `deletedAt`, `sortIndex`.
- **Vistas de tareas** (`src/features/tasks/`): `TaskActionView.tsx` (agrupa tareas `today`/`tomorrow`/`week`
  en 3 columnas por `energyLevel`; drag&drop cambia `energyLevel`), `TaskPlanningView.tsx` (7 columnas
  por día, drag cambia `startDate`), `TaskBacklogView.tsx` (status `backlog`), `TaskArchiveView.tsx`
  (`done`/`archived`). Orquestadas por tabs en `TasksList.tsx`.
- **Asignación de vista por `status`** (`tasks.service.ts`, `tasks.utils.ts`): si `taskType='idea'` →
  forzado a `backlog`; sin `startDate` → `backlog`; con `startDate` → status derivado de la fecha
  (`deriveStatusFromDate`). Reconciliación diaria en login (lazy) o cron.
- **Dashboard** (`src/app/(app)/dashboard/page.tsx`): es el landing tras login, es **cross-sistema**
  (query por `userId`, no por `systemId`), pero **solo muestra status `today` + `done`**. Tiene una
  "Smart View" que ordena por prioridad y luego energía. **NO** existe Energy Check-in. **NO** muestra
  mañana/semana/vencidas/backlog. El feature `src/features/dashboard/` está **vacío** (todo vive en la page).
- **Slices preexistentes útiles**: `scheduler` (Lazy Evaluation + Vercel Cron) y `notifications`
  (Web Push + reportes). El planificador se apoyará en estos.
- **Estado de UI**: solo existe un store Zustand (`systems.store.ts`, para el sidebar). No hay store
  de tareas ni de filtros. El filtrado de vistas hoy es **client-side** sobre datos sin filtrar.

---

## Contexto — por qué hacemos esto

Hoy Kino tiene **captura** (backlog), **ejecución** (vista Action por energía) y **planificación manual** (vista Planning), pero **ninguna superficie mira hacia adelante**. Al entrar a un sistema solo se ve "hoy + columnas de energía"; backlog y lo que empieza mañana quedan fuera de vista → fuera de mente. El dashboard tampoco ayuda: es cross-sistema pero también solo muestra "hoy + done".

Resultado: la app no logra recordarle al usuario lo que realmente tiene que hacer, ni lo ayuda a organizarse. Además, la energía es hoy **metadata pasiva** (una etiqueta en la tarea que solo define en qué columna cae), cuando la tesis de Kino es *emparejar el trabajo con la energía real del usuario*.

**Objetivo**: que Kino **proponga activamente un plan del día** ("hoy haces estas tareas, en este orden"), interpretando correctamente la importancia de las tareas y la necesidad de mantener la energía estable para trabajar de forma efectiva.

Esto se compone de dos capas que faltan:
1. **Previsión / planificación activa** — resuelve "no me recuerda qué hacer".
2. **Loop activo de energía** (check-in → propuesta) — convierte la energía de etiqueta a motor.

---

## 1. Modelo de energía (corregido contra evidencia)

> Verificado con investigación. Ver sección *Fundamento científico*. Punto clave: **NO modelamos energía como combustible que cada tarea retira** (eso es *ego depletion*, teoría caída en la crisis de replicación). La modelamos como capacidad circadiana menos fatiga por trabajo continuo.

```
energía_efectiva(t) = capacidad(t) − fatiga_continua

capacidad(t)    = curva_cronotipo(t) × factor_sueño     ← circadiano (sólido)
fatiga_continua = sube con minutos trabajados SIN pausa;
                  un descanso la resetea                 ← ultradiano (sólido)
```

- **Batería 0–100** ("puntos de energía"), escala intuitiva y graficable.
- **`capacidad(t)`**: curva natural según la hora, definida por cronotipo (preset elegido en onboarding) y escalada por el sueño de anoche.
- **`factor_sueño`**: bien descansado ×1.0 · parcial ×0.8 · mal ×0.6 (multiplica toda la curva del día).
- **`fatiga_continua`**: acumula con minutos de trabajo continuo; un descanso (~cada 90 min, ultradiano) la resetea.
- **Piso = 20**: zona de quemado. El plan nunca debe proyectar al usuario bajo el piso.
- **Energía de la tarea** (`high/medium/low`): ya **no resta combustible**. Sirve para *colocar* — tareas `high` van donde `energía_efectiva` es alta (picos, recién salido de un descanso). La dificultad puede acelerar la fatiga (modificador menor), no es retirada literal de puntos.

**Recarga/gasto personalizado** (por usuario, con signo): comer puede ser `+15` para unos o `−10` (sueño post-comida) para otros. Cada usuario define el signo en onboarding. Caveat: pausas con pantalla (videojuegos) recuperan ánimo pero NO restauran atención igual que un descanso real.

Todos los números viven como **constantes nombradas y ajustables** — la calibración es el riesgo principal (ver *Riesgos*).

---

## 2. Fórmula de importancia

```
importancia = 1.0 · urgencia_deadline + 0.8 · prioridad + 0.3 · antigüedad
```

- **prioridad**: critical 100 · high 70 · medium 40 · low 15
- **urgencia_deadline**: vencida 100 · hoy 80 · mañana 50 · esta semana 25 · sin fecha 0
- **antigüedad**: `min(días_desde_creación × 2, 30)` — empuja lo viejo a la superficie sin dominar

El deadline manda, luego prioridad, antigüedad solo desempata. **Ideas** excluidas (van a backlog). **Recordatorios** anclados a su hora — no se rankean, se colocan en su hora fija.

---

## 3. Algoritmo del planificador (greedy, legible)

1. Candidatas = tareas `today` (+ jalar de `tomorrow`/`week` si sobra capacidad).
2. Ordenar por importancia.
3. Recorrer el día en slots usando `estimatedTime`: tareas `high` en ventanas de `energía_efectiva` alta, `low` en los bajones.
4. Simular batería. Si una colocación proyecta bajo el piso → insertar descanso (resetea fatiga) o diferir la tarea.
5. Parar cuando el día se llena o la energía no sostiene más trabajo.

Salida: plan ordenado + descansos insertados + marca **"empieza aquí"**. Greedy no es óptimo, pero es **explicable** — y explicable = confianza.

---

## 4. Inferencia y consejero

La app **infiere** (deduce sin preguntar) del comportamiento ya capturado: tareas creadas/día, sin completar, vencidas, distribución de energía/prioridad. La inferencia vive en el modo **CONSEJERO**: nombra el patrón y *ofrece una solución*, el usuario decide. Nunca dicta en silencio (modo "actor" descartado por riesgoso) ni solo muestra el problema (modo "espejo", insuficiente).

### Patrones (catálogo)

| # | Patrón | Señal | Ofrece |
|---|--------|-------|--------|
| 1 | **Sobrecarga** | muchas creadas/día, alto % high/critical, batería proyectada bajo el piso | "Hoy hay más de lo que tu energía aguanta. ¿Muevo las 3 menos urgentes a mañana?" |
| 2 | **Abandono / parálisis** | vencidas acumulándose, completion rate bajo, tareas viejas sin tocar | "Tienes 25 vencidas. ¿Empezamos con la más pequeña para destrabar?" |
| 3 | **Desorganización / prioridad plana** | todo critical, o nada con fecha/energía | "8 tareas críticas hoy — no todo puede ser crítico. ¿Elegimos las 2 reales?" |
| 4 | **Sub-uso** | crea/completa muy poco | nudge ligero, no plan agresivo |

La carga acumulada (vencidas + sobrecompromiso) **modula la batería inicial**: arrancar viendo 30 vencidas = empezar agotado. Inferencia → consejo *y* ajuste del motor.

### Prioridad de avisos (triage)

Dos niveles + **un consejo primario a la vez** (el resto se encola):

- **Nivel 1 — Interrumpe (push)**: solo urgente y sensible al tiempo. Disparan push **sobrecarga-hoy** y **cruce de umbral**. Nada más.
- **Nivel 2 — Ambiental (solo dashboard)**: patrones crónicos (abandono, prioridad plana, sub-uso). No persiguen.

Ranking: `prioridad = severidad × urgencia × accionabilidad`. Si no hay acción clara, no se muestra.

---

## 5. Modelo de datos (tablas nuevas)

Definir en `src/shared/db/schema.ts`. Respetar reglas del proyecto (UTC TIMESTAMPTZ, `user_id` desde sesión, FKs con ON DELETE correcto).

| Tabla | Qué guarda | Volumen |
|-------|-----------|---------|
| `user_energy_profile` (1:1 user) | cronotipo, params de curva, sueño típico, recarga/gasto personalizado (con signo), piso, horas disponibles | 1 fila/user |
| `energy_checkins` | fecha, nivel actual, calidad de sueño, ánimo | 1/día |
| `behavior_snapshots` | rollup diario: creadas, completadas, vencidas, #critical | 1/día/user |
| `daily_plans` | plan propuesto + mensaje del consejero del día | 1/día |
| `energy_events` (opcional, fase Run) | tipo (break/meal/leisure/task), delta, hora | varios/día |

**Anti-balloon (Railway $0)**: rollups diarios para tendencias (no recalcular sobre raw); podar `energy_events` > 90 días.

---

## 6. Onboarding (motivador, orientado a resultados)

Principio: **cada pregunta o personaliza el motor o motiva**; si no hace ninguna, se elimina. Mostrar *resultados / problemas resueltos*, no un tour de features.

1. **Gancho de resultado** — "Kino arma tu día según tu energía, no solo tu lista."
2. **Cronotipo** — ¿cuándo rindes más? → preset de curva.
3. **Sueño típico** — horas → factor base por defecto.
4. **Qué te recarga / qué te gasta** — presets con signo → `user_energy_profile`.
5. **Horas disponibles/día** — → capacidad.
6. **Primer sistema** — "¿qué área de tu vida quieres ordenar primero?" (identidad; combate sub-uso día 1).
7. **Pantalla de promesa** — muestra un plan de ejemplo ya armado con sus datos: "esto verás cada mañana".

---

## 7. Dashboard (bento moderno, sin saturar)

Regla: **2 celdas grandes mandan (batería + plan); el resto son glances de 2 segundos.** ~6 celdas máximo.

| Celda | Tamaño | Contenido |
|-------|--------|-----------|
| Check-in + batería | grande | Input del día + curva proyectada vs real |
| Plan de hoy | grande/alto | Tareas ordenadas + descansos + "empieza aquí" |
| Consejero | mediano | Tarjeta del patrón activo (aparece/desaparece) |
| Racha / momentum | pequeño | Días seguidos cumpliendo el plan |
| Pulso de carga | pequeño | Vencidas + creadas hoy (espejo honesto) |
| Sistemas | mediano | Acceso rápido + salud de cada sistema |

Rotar/fase posterior: tendencia semanal de energía, "mejor hora para X", insight del día, heatmap de completado por hora.

---

## 8. Arquitectura ($0 / serverless)

No hay worker persistente. "Background" se resuelve en dos vías:
- **Lazy-eval al entrar**: cálculo al abrir, dentro del límite de 10s (heurística sobre conteos = rápido). Alimenta el **dashboard**.
- **Vercel Cron (1×/día)**: precalcula y guarda; alimenta la **notificación push** cuando el usuario no está en la app.

Encaja con los slices existentes `scheduler` (Lazy Evaluation) y `notifications` (Web Push). Regla: *dashboard = lazy-eval, push = cron.*

### Ubicación del código (vertical slices)
- **Nuevo slice `src/features/energy/`**: motor de energía, fórmula de importancia, planificador,
  inferencia/consejero y sus `*.routes.ts` / `*.service.ts` / `*.queries.ts` / `*.schemas.ts` /
  `*.types.ts`. Las funciones puras (importancia, `capacidad(t)`, simulación de batería, ranking)
  van en el `*.service.ts` o en `*.utils.ts` para testearse aisladas.
- **Onboarding**: extender el slice existente `src/features/onboarding/`.
- **Dashboard**: poblar `src/features/dashboard/` (hoy vacío) y consumirlo desde
  `src/app/(app)/dashboard/page.tsx`.
- **Schema**: las 5 tablas nuevas en `src/shared/db/schema.ts` (fuente única).
- **Disparadores**: registrar el cron en el slice `scheduler`; el push en `notifications`.

---

## 9. Orden de construcción (crawl-walk-run)

Cada capa se envía y gana confianza antes de la siguiente.

### ~~Crawl~~ ✅ — probar el lazo (completado 2026-05-20)
- ~~`user_energy_profile` + onboarding (todos los pasos de la sección 6; el paso 7 "pantalla de~~
  ~~promesa" puede mostrar un plan de ejemplo estático hasta que el planificador real exista).~~
- ~~Check-in diario (`energy_checkins`).~~
- ~~Fórmula de importancia (#2).~~
- ~~Planificador **solo presupuesto** (suma de tiempos ≤ horas disponibles, sin curva).~~
- ~~Tarjeta "Plan de hoy" en dashboard.~~

**Commits entregados:**
- `feat(energy)`: enums `chronotype`/`sleep_quality` + tablas `user_energy_profile` y `energy_checkins`
- `feat(onboarding)`: backend (schemas, queries, service, routes)
- `feat(onboarding)`: UI wizard 7 pasos + redirect automático
- `feat(energy)`: endpoint check-in diario (`POST/GET /api/energy/checkin`)
- `feat(energy)`: fórmula de importancia pura + 8 unit tests
- `feat(energy)`: planificador greedy solo-presupuesto + 9 unit tests
- `feat(dashboard)`: tarjeta "Plan de hoy" con lazy-eval al entrar

### Walk — realismo de energía ← **SIGUIENTE**
- Curva por cronotipo + `factor_sueño`.
- Simulación de batería (`capacidad − fatiga_continua`) + descansos insertados.
- Celda "Check-in + batería" con curva proyectada vs real.

### Run — inteligencia
- `behavior_snapshots` + inferencia + consejero (catálogo + triage).
- Cron + push (Nivel 1).
- Tendencias e insights en el dashboard.

---

## 9b. Desglose paso a paso

Cada paso compila, pasa `pnpm typecheck && pnpm lint`, y tiene su prueba antes de pasar al
siguiente. Funciones puras (importancia, simulación) se testean con unit **antes** de cablearlas a UI.

### ~~Crawl~~ ✅ (completado)
1. ~~`user_energy_profile` en `schema.ts` + migración → `db:push` smoke test.~~ ✅
2. ~~Onboarding backend: Zod + service + route.~~ ✅
3. ~~Onboarding UI (pasos 1–7; paso 7 con plan estático).~~ ✅
4. ~~`energy_checkins` + endpoint de check-in.~~ ✅
5. ~~Fórmula de importancia (función pura) + unit tests.~~ ✅
6. ~~Planificador solo-presupuesto (función pura) + unit tests.~~ ✅
7. ~~Tarjeta "Plan de hoy" en dashboard (lazy-eval).~~ ✅

### Walk ← **EN CURSO**
1. Curva por cronotipo + `factor_sueño`: derivación de `capacidad(t)` (función pura) → unit.
2. Simulación de batería `energía_efectiva(t) = capacidad(t) − fatiga_continua` (función pura) → unit, casos límite (bajo el piso, día largo).
3. Planificador consciente de energía: colocación por ventanas + inserción de descansos (~90 min) + diferir bajo el piso → unit.
4. Celda "Check-in + batería" en dashboard: curva proyectada vs real → manual.

### Run
1. `behavior_snapshots` + rollup diario (job de snapshot) → integración.
2. Catálogo de patrones + ranking `severidad × urgencia × accionabilidad` (función pura) → unit.
3. Consejero en dashboard (Nivel 2 ambiental, un consejo a la vez) → manual: forzar cada patrón.
4. Cron + Web Push (Nivel 1: sobrecarga-hoy + umbral) → integración; verificar `CRON_SECRET`.
5. Tendencias e insights (gráficos semanales) → manual.

> Nota previa a codear: definir los números (pesos de importancia, capacidad por hora del
> cronotipo, horas disponibles) o arrancar con los defaults del plan y calibrar con uso real.

---

## 9c. Convención de commits (obligatoria)

- **Commit después de cada feature / cambio coherente.** No acumular varios cambios sin relación
  en un solo commit (ej. NO modificar 10 archivos de distintas features y commitearlos juntos).
  Cada commit representa **un** cambio o **un** feature nuevo.
- **Conventional Commits**, mensaje de **una sola línea** que explica el cambio. Prefijos:
  `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`.
  - Ejemplos: `feat(energy): add user_energy_profile table and migration` ·
    `feat(energy): add importance scoring pure function` ·
    `test(energy): add unit tests for battery simulation`.
- **Prohibido** agregar `Co-Authored-By: Claude` (ni ninguna co-autoría de IA) en los mensajes.
- Antes de cada commit: `pnpm typecheck && pnpm lint` (y `pnpm build` antes de un PR).
- Cada paso del desglose (sección 9b) es una unidad razonable de commit.

---

## 10. Verificación

- **Unit** (service/funciones puras): fórmula de importancia, simulación de batería, derivación de `capacidad(t)`, ranking del consejero. Casos límite: sin tareas, sin `estimatedTime`, todo critical, batería bajo el piso.
- **Integración** (API): check-in → plan generado; cron → snapshot + push.
- **Manual en navegador**: completar onboarding, hacer check-in, ver el plan propuesto, forzar cada patrón del consejero (crear muchas vencidas, marcar todo critical) y verificar el triage (un solo consejo, el correcto).
- `pnpm typecheck && pnpm lint && pnpm build` antes de cada PR.

---

## 11. Riesgos

- **Calibración** (principal): cada número del motor es una suposición. Mantenerlos como constantes ajustables; validar con uso real antes de "endurecer". Si el plan se siente arbitrario, el usuario lo ignora una vez y muere.
- **Inferencia equivocada**: neutralizada por el modo consejero (sugiere, no dicta). Mantener mensajes tentativos y legibles, nunca veredictos.
- **Cold start**: la inferencia necesita historial; degradar con gracia los primeros días.
- **Scope**: es un sistema, no un feature. Respetar crawl-walk-run; no construir Run antes de validar Crawl.

---

## Fundamento científico (resumen de la investigación)

- **Curva por cronotipo/hora — SÓLIDO.** Los picos cognitivos dependen del cronotipo y la hora.
- **Sueño fija la capacidad del día — SÓLIDO.**
- **Descansos restauran (ultradiano ~90 min) — SÓLIDO.** Caveat: descansos con pantalla restauran menos la atención.
- **"Cada tarea difícil agota un tanque" — DÉBIL/REFUTADO.** Ego depletion no replicó (23 labs, 2,100+ sujetos; efecto ~cero tras corregir sesgo de publicación). Por eso el motor usa *capacidad − fatiga continua*, no combustible por tarea.

Fuentes:
- The Collapse of Ego Depletion — Michael Inzlicht: https://www.speakandregret.michaelinzlicht.com/p/the-collapse-of-ego-depletion
- A Multilab Replication of the Ego Depletion Effect — PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC8186735/
- Time of day and chronotype on cognitive/physical performance — PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC6200828/
- Cognitive functions associated with chronotype — Nature Communications: https://www.nature.com/articles/s41467-021-24885-0
- Ultradian Rhythms: 90-Minute Brain Cycles — Neurosity: https://neurosity.co/guides/ultradian-rhythm-90-minute-brain-cycles
- Effects of sleep deprivation on cognitive performance — Wikipedia: https://en.wikipedia.org/wiki/Effects_of_sleep_deprivation_on_cognitive_performance

---

## Glosario

- **Cronotipo**: tendencia natural de una persona a rendir mejor en cierto momento del día
  (mañana / tarde / noche). Determina la forma de `capacidad(t)`.
- **Ritmo circadiano**: ciclo biológico de ~24h que regula la energía/alerta según la hora.
- **Ritmo ultradiano**: ciclos más cortos (~90 min) de foco; tras ~90 min de trabajo continuo el
  rendimiento cae y conviene una pausa. Justifica insertar descansos.
- **Ego depletion**: teoría (refutada en la crisis de replicación) de que la fuerza de
  voluntad/energía mental es un recurso que se agota con el uso. **No** la usamos como base.
- **`capacidad(t)`**: techo de energía a la hora `t` = curva del cronotipo × factor de sueño.
- **`fatiga_continua`**: penalización que sube con minutos de trabajo sin pausa y se resetea con un
  descanso.
- **`energía_efectiva(t)`**: energía real disponible = `capacidad(t) − fatiga_continua`.
- **Piso (floor)**: nivel de batería (20/100) bajo el cual se entra en "zona de quemado"; el plan
  no debe proyectar al usuario por debajo.
- **Check-in de energía**: input diario donde el usuario reporta su nivel actual y cómo durmió.
- **Inferencia**: deducir algo del usuario sin preguntarlo, a partir de datos ya capturados
  (tareas creadas, vencidas, etc.).
- **Modos espejo / consejero / actor**: espectro de qué hace la app con una inferencia — mostrar el
  dato (espejo), sugerir una solución que el usuario aprueba (**consejero**, el elegido), o actuar
  solo sin preguntar (actor, descartado).
- **Lazy Evaluation**: en vez de un worker en background, el cálculo se hace "perezosamente" cuando
  el usuario entra a la app (catch-up al login), dentro del límite de 10s.
- **Vertical Slice**: organización donde cada feature es una carpeta autocontenida con su backend y
  frontend, sin acoplarse a internals de otras features.
- **ltree**: tipo de PostgreSQL para jerarquías en árbol (usado para carpetas de páginas).
- **Optimistic UI**: actualizar la UI antes de la respuesta del servidor y hacer rollback si falla.
- **Crawl / Walk / Run**: las tres fases incrementales de construcción (ver sección 9), cada una
  termina en algo funcional y testeable.
