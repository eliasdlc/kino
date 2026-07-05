# Kino — Plan Maestro de Implementación

> **Documento vivo.** Única fuente de verdad sobre qué construimos, en qué orden, con qué decisión arquitectónica y bajo qué criterio de "terminado". Los audits y docs de decisión alimentan este documento; cuando algo cambie, se actualiza aquí primero.
>
> **Última actualización:** 2026-07-05 · **Fase activa:** Fase 2 (Calidad percibida) · **Estado global:** ▰▰▱▱▱▱ 2/6 fases · Fase 0 ✅ · Fase 1 ✅ code-complete (rama `fase-0-confianza`; tsc limpio · lint 0 errores · 193/193 tests · migraciones idempotentes). **Pendientes de owner (no bloquean código):** aplicar migraciones `0002`+`0003` a prod (Hard Stop) y configurar el cron externo de reminders (`docs/CRON-REMINDERS.md`).
>
> Fuentes: [`STATUS.md`](./STATUS.md) · [`AUDIT-2026-07.md`](./AUDIT-2026-07.md) · [`AUDIT-FEATURES-2026-07.md`](./AUDIT-FEATURES-2026-07.md) · [`DECISIONES-2026-07.md`](./DECISIONES-2026-07.md) (D1–D8) · [`DISENO-ARQUETIPOS-2026-07.md`](./DISENO-ARQUETIPOS-2026-07.md) (D9–D16)

---

## La meta

**Kino es la app de planificación que entiende tu energía.** No una lista de tareas más, no un Notion genérico: un sistema que aprende tu curva de energía real, organiza tu día/semestre/novela alrededor de ella, y que un agente puede operar por ti vía MCP.

El norte medible: en doce meses Kino debe poder decir, sin mentir y en pantalla, *"te sugerí deep work a las 9am, lo hiciste, tu check-in lo confirmó, mi modelo de ti mejoró 4%"*. Ninguna app del nicho puede — ninguna tiene el motor de energía ni ~50 MCP tools.

**Este plan no agrega features. Termina de conectar lo que Kino ya captura y lo hace confiable**, para que un usuario real tenga un flujo cómodo, natural y sin sorpresas: abre la app, ve la verdad, planifica sin fricción, y confía en lo que Kino le dice.

**Definición de "usable por gente real"** (el estado que este plan persigue, condición de salida del conjunto Fase 0–2):
1. Nada en la UI muestra un dato falso o desactualizado.
2. Ninguna acción del flujo principal crashea o lanza un error crudo.
3. El build está verde: `tsc` limpio, `lint` sin errores, tests 100% en verde.
4. Un usuario nuevo entiende qué hace cada pantalla sin explicación, y cada CTA cumple lo que promete.

---

## El rumbo

Cuatro principios ordenan cada trade-off. Cuando dos items compitan, gana el que esté más arriba.

1. **Confianza en el core primero.** Una app de planificación vive de que confíes en lo que te muestra. Un indicador que miente, un contador corrido 4 horas, un recordatorio tardío — cada uno destruye más valor del que aporta cualquier feature nueva. Por eso Fase 0 va antes que todo, sin excepción.
2. **El diferenciador es el motor de energía + agent-native.** Todo lo que lo afile sube de prioridad; todo lo que compita donde los grandes son imbatibles (bloques de editor) baja o se plantea como integración, no como feature.
3. **Menos peso muerto.** El schema debe contar la historia de "app de energía enfocada", no la de "app gamificada abandonada". Lo que no sirve a la tesis se elimina, no se deja dormido.
4. **Cero costo monetario.** Ninguna fase requiere pagar nada. Los dos gastos que algún día valdrían la pena (Vercel Blob, Vercel Pro) están aislados y diferidos por señal ([§ Gastos](#lo-único-que-costaría-dinero)).

Tesis de crecimiento (desde Fase 3): **los arquetipos son la adquisición.** "App de productividad para todos" ya lo ganaron Notion/Todoist. "La app que entiende tu semestre / tu novela **y tu energía**" es una cuña por segmento que nadie ocupa; cada arquetipo bien hecho es un mercado nuevo a costo marginal casi cero — eso compra la arquitectura de manifiesto (D9).

---

## Estándares de ingeniería (aplican a todo el plan)

El *cómo* trabajamos, no negociable. Esto es lo que hace que "correcto" signifique lo mismo en cada fase.

**Definition of Done (DoD) — un item no se marca `[x]` hasta cumplir los 6:**
1. El criterio de aceptación específico del item pasa (ver cada item).
2. `pnpm tsc --noEmit` limpio.
3. `pnpm lint` sin errores (warnings documentados si son inevitables).
4. `pnpm test` en verde; si el item toca lógica, **hay un test nuevo que fallaría sin el fix**.
5. Un commit atómico con mensaje Conventional Commits que describe el *qué* y el *por qué*.
6. Una línea en `~/Documents/Kino-DECISIONS.md` si hubo una decisión no trivial.

**Disciplina de datos y migraciones:**
- **DB-01 es un candado global:** ninguna migración de ninguna fase corre hasta que el journal de Drizzle esté rebaselineado. Con el journal desincronizado, todo `drizzle-kit generate` produce una migración divergente o destructiva.
- Toda migración: reversible o con plan de rollback escrito; datos existentes migrados explícitamente (nunca se asume tabla vacía); probada contra una copia antes de prod.
- Cualquier op destructiva (drop de tabla/columna, backfill masivo) se confirma con el owner antes de correr en prod. Es un Hard Stop.

**Contratos y validación:**
- Todo input de red pasa por Zod en el server, incluidos los `metadata` jsonb (Zod discriminado por `systemType`; campos desconocidos se rechazan). El MCP recibe los mismos schemas.
- Toda query filtra por `userId`; toda FK entrante valida ownership (no basta con que la FK exista).
- Escrituras múltiples relacionadas van en `db.transaction`.

**Frontend:**
- Cada ruta de `app/` tiene su `loading.tsx` y está cubierta por un `error.tsx` de su grupo. Ninguna vista puede tumbar la app entera.
- Cálculos de fecha/tz salen del módulo único `shared/time` (Fase 0). Prohibido reimplementar "hoy en la tz del usuario".

**Ramas y verificación:**
- Trabajo en `dev`; feature branches para bloques grandes. Nunca push directo a `main` sin confirmación.
- Cada fase cierra con verificación manual del flujo que tocó, no solo con tests verdes.

---

## Mapa de fases

| Fase | Nombre | Resultado para el usuario | Esfuerzo | Depende de |
|------|--------|---------------------------|----------|------------|
| **0** ✅ | Confianza | La app no miente ni crashea | ~1 sem | — |
| **1** | Limpieza | El sistema es honesto y ligero | S | Fase 0 (DB-01) |
| **2** | Calidad percibida | Se siente un producto, no un demo | S–M | Fase 1 |
| **3** | Arquetipos (Rumbo 15) | Cada sistema habla tu idioma | M–L | Fase 0 (DB-01, BE-03) + 1 |
| **4** | Motor de energía visible | La app te conoce y lo demuestra | M | Fase 0 (BE-01) + 3 |
| **5** | Go-to-market | Cada arquetipo es un canal | S–M | Fase 3 |
| **6** | Por señal | Lo que espera evidencia de uso | — | según señal |

**Rumbo 10 (vistas intercambiables) desaparece:** absorbido por el manifiesto (D9) en Fase 3. El tipo `ArchetypeManifest` y la config de los 6 tipos **ya existen** en `src/shared/lib/system-types.ts` (commit KIN-122); Fase 3 los *conecta*, no los inventa.

---

## Fase 0 — Confianza

> **Resultado:** el usuario puede confiar en cada número y cada estado que ve, y ninguna acción del flujo principal rompe la app.
> **Orden interno estricto:** `DB-01` → `shared/time` → el resto en paralelo → `D3` (cierra la suite en verde).

### 0.1 · DB-01 · Rebaseline del journal Drizzle *(High · candado global)*
**Decisión:** el journal es la fuente de verdad de las migraciones; hoy registra 2 entradas para 10+ SQL aplicados por fuera. Se rebaselinea contra la DB real y desde ahí el flujo vuelve a ser `generate → review → migrate`.
**Pasos:**
1. Backup de `drizzle/` completo (por si acaso) fuera del repo.
2. Verificar el schema real de prod (`drizzle-kit introspect` contra la DB) y confirmar que `schema.ts` lo refleja; anotar cualquier drift.
3. Borrar `drizzle/meta/` y los SQL huérfanos; generar un snapshot baseline `0000_baseline` desde `schema.ts` actual.
4. Reconstruir `_journal.json` con esa única entrada baseline marcada como ya aplicada en prod (tabla `__drizzle_migrations`).
5. Confirmar idempotencia: `drizzle-kit generate` sobre schema sin cambios produce **diff vacío**.
**Aceptación:** `drizzle-kit generate` es no-op sobre `schema.ts` limpio; un `migrate` sobre una DB vacía de prueba reproduce el schema real byte a byte.

### 0.2 · BE-01 + BG-04 + AR-02 · Módulo único `shared/time` *(High)*
**Decisión:** "hoy en la tz del usuario" existe hoy en 4 implementaciones que ya divergieron. Se colapsan en un módulo canónico `src/shared/time/` — helper TS + fragmento SQL — y se prohíbe reimplementarlo.
**Pasos:**
1. Crear `src/shared/time/index.ts` con: `userToday(tz): string` (yyyy-MM-dd), `userDayRange(tz): { start: Date; end: Date }` (timestamptz del día local), y un helper de fragmento SQL `sqlUserDay(tzExpr)` que produzca la expresión correcta `((NOW() AT TIME ZONE tz)::date::timestamp AT TIME ZONE tz)`.
2. Migrar los 4 call sites: presupuesto de energía (`tasks.service.ts:73`, el bug), `ensureTodayPlanRolled` (`:671`, ya correcto → usar el helper igual), `getTodayDate` (`energy.service.ts:54`), snapshot diario (`scheduler.service.ts:11`).
3. Absorber `calendarDateInTz` de `tasks.utils.ts` al módulo (o reexportar) para que haya un solo origen.
**Aceptación:** test con `America/Santo_Domingo` (UTC-4): una tarea completada a las 21:00 local cuenta contra el día local correcto, no contra el día siguiente. El test falla con el código viejo.

### 0.3 · FE-01 · Fix rules-of-hooks en `GlobalCalendarView` *(High)*
**Decisión:** un hook condicional puede tumbar el calendario completo. Se corrige la estructura, no se silencia el lint.
**Pasos:** mover el `if (!d) return null` de `:154` a *después* del `useDraggable` de `:161`, o extraer el subcomponente draggable para que el early-return viva en el padre.
**Aceptación:** `lint` sin `react-hooks/rules-of-hooks`; el calendario no crashea cuando una tarea pierde su fecha mientras está montado (verificación manual: limpiar fecha con el calendario abierto).

### 0.4 · BE-03 · Ownership de FKs entrantes *(High · prerrequisito de Fase 3)*
**Decisión:** filtrar por `userId` en la query principal no basta; cada FK entrante debe pertenecer al usuario. Cerrarlo ahora porque los kinds de arquetipo (Fase 3) referencian folders/parents.
**Pasos:**
1. `updateTask`: validar `parentTaskId` → existe + es del usuario + **no es la propia tarea** + no genera ciclo (recorrer la cadena de padres). Rechazar con 422.
2. `createTask`/`updateTask`: validar `contextTagId` del usuario.
3. `createTimeLog`: validar `systemId` del usuario **y** que coincida con `task.systemId`.
4. `createPage`: validar `parentPageId` del usuario (hoy solo valida `folderId`).
**Aceptación:** un test por cada regla que hoy pasa incorrectamente (self-parent, parent ajeno, ciclo A→B→A, tag ajeno, timeLog con systemId ajeno) y que ahora devuelve 422/404.

### 0.5 · BE-05 + BE-09 · Notificaciones honestas *(Medium/Low · prerrequisito de D4)*
**Decisión:** una notificación no se marca como enviada si el push falló; sin esto, subir la frecuencia del cron (D4) amplifica la pérdida.
**Pasos:**
1. En `sendStandardReminders`/`sendPendingReminders`: marcar como notificadas **solo** las tareas de usuarios cuyo `web-push` resolvió (usar el resultado de `allSettled`, no marcar en bloque).
2. Guard: `if (!process.env.CRON_SECRET) return 500` antes de comparar el Bearer.
**Aceptación:** test que simula un push rechazado y verifica que esa tarea queda sin marcar (re-intentable); request al cron sin `CRON_SECRET` en env responde 500, no 200.

### 0.6 · D3 (BE-02 / BG-01 / AR-04) · Modelo único de borrado *(High · cierra la suite)*
**Decisión:** un solo modelo — papelera vía `deletedAt`. `archived` se elimina como status; hoy hay dos semánticas a medias y ninguna funciona completa.
**Pasos:**
1. Quitar `archived` del `TRANSITION_MAP`, del Zod de `move` (`tasks.schemas.ts:96-99`) y del tool MCP `bulk_move_tasks`.
2. Borrar `deriveAction` duplicado (`tasks.service.ts:152-173`); derivar la acción del `TRANSITION_MAP` único (cierra AR-04 y el 422 fantasma).
3. Migración de datos: `status='archived'` → papelera (`deletedAt`) si venía borrada, o `completed` si no.
4. Arreglar/eliminar el test `archived + soft_delete` según el modelo nuevo.
**Aceptación:** suite **179/179**; `bulk_move_tasks` con cualquier status válido ya no da 422; no queda referencia a `archived` como status vivo.

### 0.7 · FE-02 + UX-05 · Boundaries y estados de carga *(Medium)*
**Decisión:** ninguna vista puede tumbar la app; ningún 404 cae en la pantalla cruda de Next.
**Pasos:**
1. `error.tsx` a nivel de `app/` (y por grupo `(app)` si el reset difiere) con botón de recuperación.
2. `not-found.tsx` amable con vuelta al dashboard.
3. `loading.tsx` para las 4 rutas que faltan: `/tasks`, `/calendar`, `/settings`, `/systems` (hoy solo existen en dashboard y systems/[id]).
**Aceptación:** forzar un throw en un server component de `/tasks` muestra el error boundary, no la pantalla blanca de Next; navegar a un sistema inexistente cae en el not-found propio.

### 0.8 · FE-04 / BG-02 · Fix set-state-in-effect *(Medium)*
**Decisión:** eliminar los `setState` síncronos en efecto (cascading renders) por inicialización lazy / `useSyncExternalStore`.
**Pasos:** corregir `AuthForm.tsx:48` (`setCoach`) y `HeroDemo.tsx:50` (`setMounted`).
**Aceptación:** `lint` a **0 errores** (junto con 0.3 cierra BG-02).

**Criterio de salida de Fase 0:** `tsc` limpio · `lint` 0 errores · **179/179** tests · migraciones seguras (DB-01) · nada en la UI muestra dato falso *excepto* el indicador de salud (cae en 1.2).

---

## Fase 1 — Limpieza

> **Resultado:** el sistema es honesto (los indicadores reflejan actividad real) y ligero (sin tablas/columnas muertas). El schema cuenta la historia correcta.
> Todas las migraciones de esta fase dependen de DB-01 (Fase 0).

### 1.1 · Rumbo 13 ampliado (D1 + D6) · Eliminar peso muerto ✅ *(A+B hechos; DB-06 diferido)*
**Decisión:** la gamificación se elimina completa, incluido el write de XP; el "pico de energía declarado" (`peakEnergy*`) contradice la tesis (Kino lo *aprende*, no lo pregunta). **Cambio de alcance:** `sync_connections`/`syncProviderEnum` **se conservan** — son la base del sync a apps externas (Notion/Calendar/Slack), feature futuro sembrado a propósito, no peso muerto.
**Pasos:**
1. ✅ **Commit A** — matar el write de XP en `tasks.service.ts` (efecto `grant_xp/revert_xp`, `xpDelta`, `xp_earned`); `taskEnergyPoints` se conserva (alimenta el presupuesto de energía, no la gamificación).
2. ✅ **Commit B** — migración `0001` (aplicada a Neon): drop `quests`, `inventory_items`, `energy_logs` + tipos huérfanos `item_type`/`quest_type`; drop `users.xpTotal/coins/lastSyncDate` y `user_settings.peakEnergyStart/End/brainDumpDefaultSystem`. `lastSyncDate` cae por redundante con `sync_connections.lastSyncedAt`.
3. ⏸️ **DB-06 diferido** — poda de valores legacy de `taskTypeEnum` (`habit/todo/project`) y `banned` de `accountStatusEnum`: Postgres no tiene `DROP VALUE`, obliga a recrear el tipo (riesgo/pago cosmético). Baja a deuda "al tocar" ese enum. `syncProviderEnum` ya no se toca (feature vivo).
**Aceptación:** ✅ el toggle ya no escribe XP; grep de símbolos de gamificación da 0 fuera de `taskTypeEnum` legacy; `db:generate` no-op tras aplicar (DB = schema).

### 1.2 · D5 · Salud de sistemas derivada ✅
**Decisión:** derivar > mantener. En vez de poblar una tabla denormalizada, se calcula on-the-fly.
**Hallazgo de grounding (divergencia del plan v2):** `getSystemHealthIndicator` + su endpoint `/api/systems/[id]/health` **no tenían consumidores** y leían una tabla `system_health` que **nunca se escribía**. No se reescribe: se **borra** el path muerto completo. El stale vivo que alimenta `find_stale_systems` era `queryInactiveSystems`, y ahí estaba el bug de UX-01: medía `MAX(tasks.createdAt)` (última tarea *creada*), no actividad.
**Pasos (hechos):**
1. ✅ Borrado del path muerto: tabla `system_health`, `getSystemHealthIndicator`, ruta `/health`. Migración `0002` (`DROP TABLE system_health CASCADE`) — ⚠️ **pendiente de aplicar a prod** (Hard Stop, confirmar con owner).
2. ✅ `queryInactiveSystems`: actividad = `max(tasks.completedAt, time_logs.createdAt)`; sin actividad se mide contra `createdAt` (no un sentinela 999). Mapper puro `toStaleSystemRows` extraído + test.
3. ✅ `getUsersSystems`: suma `time_logs` a su `daysSinceActivity` (definición única de actividad).
4. ✅ `find_stale_systems` (MCP) redefinido como "sin actividad" (no "sin tareas creadas"); campo `daysSinceLastTask` → `daysSinceActivity`.
**Aceptación:** ✅ `find_stale_systems` refleja actividad real; un sistema con actividad hoy nunca aparece "stale" (cierra UX-01). Test `toStaleSystemRows` falla con el código viejo.

### 1.3 · DB-02 · Constraint e integridad de status ✅
**Pasos:** CHECK constraint en `tasks.status` (set cerrado de scheduling: `backlog/week/tomorrow/today/done`) y `boardStatus` (no-vacío cuando existe — es dinámico por systemType, no set cerrado); alinear el default de la columna de `'today'` a `'backlog'` (contradecía al servicio).
**Hecho:** migración `0003` generada, idempotente (segundo `generate` = no-op). ⚠️ **Aplicar a prod es Hard Stop** (owner): `ADD CONSTRAINT` falla si hubiera filas con status inválido (prod ya sin `archived`). Se decidió CHECK sobre migrar a pgEnum (más invasivo; `taskStatusEnum` aún lista `archived` legacy).
**Aceptación:** un INSERT con status inválido por SQL directo es rechazado por la DB (garantía a nivel DB; se verifica al aplicar contra la copia de prueba).

### 1.4 · BE-04 · Transacciones en create/bulk ✅
**Pasos:** envolver `createTask` (+ `syncAutoReminders` + insert de reminder) y `bulkCreateTasks` en `db.transaction`, pasando `tx` a los helpers (hoy usan el `db` global).
**Hecho:** extraído `createTaskInTx(tx, ...)`; tipo `Executor` (`db | tx`) para que los helpers corran dentro de la tx sin duplicar lógica; `bulkCreateTasks` corre el lote **secuencial** dentro de una tx (postgres-js no admite queries concurrentes por conexión).
**Aceptación:** ✅ test que simula fallo intermedio verifica rollback total (nada commitea); falla con el modelo viejo (`Promise.all` de `createTask`, una tx por item).

### 1.5 · D4 · Reminders con hora exacta (cron externo gratis) ✅ *(código; cron externo pendiente de owner)*
**Decisión:** el endpoint ya autentica por secret; nada obliga a que el trigger venga de Vercel. Se mantiene la promesa de la UI (el TimePicker recién construido) sin pagar Vercel Pro.
**Hecho:** el flujo de `remind_at` exactos ya estaba listo (`getPendingReminders` + marcado honesto de BE-05/BE-09); faltaba la frecuencia del disparo. La ruta `/api/cron/task-reminders` ahora acepta **GET (Vercel) y POST (cron externo)** compartiendo el guard por `Bearer CRON_SECRET`. ⏳ **Pendiente de owner:** configurar cron-job.org cada 15 min (secret + URL de prod) — documentado en [`CRON-REMINDERS.md`](./CRON-REMINDERS.md).
**Aceptación:** un reminder puesto para dentro de 20 min llega en la ventana de 15–30 min, no al día siguiente (cierra BE-06, UX-04) — verificable al activar el cron externo.

### 1.6 · AR-03 · Lockfile único ✅
**Pasos:** borrar `package-lock.json`, añadirlo a `.gitignore` (el workspace es pnpm). **Hecho.**

### 1.7 · Higiene Linear ✅
**Pasos:** marcar Rumbos 01–05 Completed, cerrar Rumbo 01, subir Rumbo 12 a High, ampliar alcance de KIN-102.
**Hecho:** Rumbos 01–05 ya Completed y Rumbo 12 ya High (updates del 2026-07-03). KIN-102 ampliado al alcance real de D1/D6 (write de XP + columnas de user/settings, no solo schema) y marcado Completed (migración `0001` aplicada a Neon).

**Criterio de salida de Fase 1:** ✅ cero símbolos muertos fuera del schema · indicador de salud honesto · reminders con hora a tiempo (código) · journal consistente. **Queda en manos del owner:** aplicar migraciones `0002`+`0003` a prod y encender el cron externo.

---

## Fase 2 — Calidad percibida

> **Resultado:** con ~20 features vivas, se cierran los gaps que delatan "app de un dev" frente a Notion/Todoist. Ordenados por impacto/esfuerzo.

### 2.1 · Búsqueda global — Rumbo 11 fase 1 *(S · gap #1 de percepción)*
**Decisión:** con el volumen actual, `ILIKE` basta; no esperar a tsvector. Cmd+K debe *encontrar*, no solo navegar.
**Pasos (KIN-88..91):** endpoint de búsqueda `ILIKE` sobre título/contenido de tasks, pages y systems (filtrado por `userId`); integrarlo al command palette con resultados agrupados y navegación por teclado.
**Aceptación:** escribir en Cmd+K el título de una tarea la encuentra y navega a ella.

### 2.2 · Settings completo *(S · la pantalla que más delata inmadurez)*
**Decisión:** Settings (hoy 2 secciones) es de las primeras pantallas que delatan una app inmadura y de las más baratas de arreglar.
**Pasos:** añadir secciones de cuenta, notificaciones (`notificationsEnabled` ya en schema), **theme conectado** (`userSettings.theme` hoy es preferencia fantasma), y export del workspace.
**Aceptación:** cambiar el theme persiste y aplica; togglear notificaciones afecta el envío real.

### 2.3 · Recurrencia mínima — D7 / Rumbo 12 Sprint A *(S–M · Rumbo 12 → High)*
**Decisión:** "todos los lunes" es de lo primero que prueba un usuario de Todoist; el campo existe y los hooks mandan `null` — el peor estado (promesa visible sin cumplimiento).
**Pasos:** soportar daily/weekly/monthly; al completar una tarea recurrente, generar la siguiente instancia; conectar los hooks (dejar de mandar `null`). Base para el kind "hábito" de Personal (Fase 3).
**Aceptación:** completar una tarea "cada lunes" crea la del lunes siguiente automáticamente.

### 2.4 · Imágenes por URL — D8 *(S)*
**Decisión:** extensión `image` de Tiptap solo por URL externa (paste), sin upload, sin billing. Es lo único que le falta al editor para no sentirse de juguete; el render es el mismo cuando llegue el upload (Fase 6).
**Aceptación:** pegar una URL de imagen la renderiza inline en una page.

### 2.5 · FE-03 + FE-06 + FE-07 · Trío de fechas *(Medium/Low)*
**Decisión:** los tres son primos del mismo problema de bordes de día; se apoyan en `shared/time` de Fase 0.
**Pasos:**
1. **FE-03** — *verificar primero*: la duplicación de `deriveStatusFromDate` en `tasks.hooks.ts` puede haberse eliminado ya (grep actual vacío). Si sobrevive, extraer a helper compartido que reciba `tz`; si no, cerrar el item como resuelto.
2. **FE-06** — `dueDateHasTime` (`tasks.utils.ts:85`) debe reusar la heurística de medianoche-UTC de `parseTaskDay` (`:71`).
3. **FE-07** — la validación `due < start` (`tasks.schemas.ts:17`) debe comparar con `parseTaskDay` en ambos lados, no con slice lexicográfico.
**Aceptación:** una tarea importada por MCP a medianoche UTC no muestra hora espuria; la validación due<start no rechaza en bordes de día.

### 2.6 · Pase de empty states / micro-feedback *(S)*
**Decisión:** consistencia de vacío/carga/error en las features. Este es el pase genérico; en Fase 5 se repite con el vocabulario de cada arquetipo.
**Aceptación:** ninguna ruta principal muestra un vacío crudo sin CTA.

**Criterio de salida de Fase 2:** Cmd+K busca contenido real · Settings cubre cuenta/notificaciones/theme/export · recurrencia end-to-end · imágenes por URL · sin estados vacíos crudos.

---

## Fase 3 — Arquetipos (Rumbo 15)

> **Resultado:** cada sistema habla el idioma del usuario (clase, obra, milestone) en folders, tasks, pages y CTAs — desde **un solo manifiesto**, no forks de vistas. Prueba de fuego: un arquetipo nuevo (Fitness) cuesta ~1 día.
> **Prerrequisitos:** DB-01 (migraciones) + BE-03 (ownership de folders/parents). **Punto de partida real:** el tipo `ArchetypeManifest` y la config de los 6 tipos ya existen (`system-types.ts`, KIN-122). Falta *conectar* (componentes que lean todo el manifiesto), *persistir* (metadata columns + Zod) y *completar* (Writing).

### Sprint 1 — El manifiesto vive *(M)*
**Decisión (D9/D10):** el manifiesto ya declara `folderRole`/`pageRole`/`taskKinds`; el trabajo es que los componentes compartidos lo consuman en vez de hardcodear, y darle persistencia a los campos de folder.
**Pasos:**
1. Migración: añadir columna `folders.metadata` (jsonb) — **no existe hoy** (verificado).
2. Zod discriminado por `systemType` para `folders.metadata` (validar `professor`/`schedule`/`semester` de Academic, `targetDate` de Entrepreneurial, etc.); expuesto también al MCP.
3. Refactor de `NewFolderInline`, `FoldersList`, `SystemDetailView`, `SystemDetailHeader` para leer `folderRole` del manifiesto (noun, newLabel, fields, icon) — varios ya importan `SYSTEM_TYPE_CONFIG`; completar el consumo.
4. Folder roles vivos y editables: Academic = **Clases** (con professor/horario/semestre), Entrepreneurial = **Milestones** (targetDate real, no rename de vista), Personal = **Áreas**. Project oculta folders (`folderRole: null`), Inbox no los ofrece.
5. Absorber Rumbo 10: `view` del manifiesto como preset, override por usuario vía `systems.metadata` (como Custom ya hace con `tabs`).
**Aceptación:** crear una "clase" en Academic guarda profesor/horario y el CTA dice "Nueva clase"; en Project no hay UI de folders; añadir un manifiesto nuevo no requiere tocar estos componentes.

### Sprint 2 — Tasks diferenciadas *(M)*
**Decisión (D11):** misma fila base, badges distintos por contexto. "Cada task se ve diferente" = cada contexto muestra su info crítica y esconde el ruido, no 6 diseños.
**Pasos:**
1. Zod discriminado por `systemType` para `tasks.metadata.kind` + campos por kind (server-side; `tasks.metadata.kind` **no se valida hoy**). Mismos schemas al MCP.
2. `CreateTaskDialog` (ya lee `SYSTEM_TYPE_CONFIG`) renderiza los campos del kind activo desde el manifiesto.
3. Cards reales: `AcademicTaskCard` (chip de clase + countdown), `PersonalTaskCard` (suave, recurrencia de 2.3, sin prioridad agresiva), `EntrepreneurialTaskCard` (milestone + hipótesis), Inbox (botones de triage rápido). Componen `parts/` existentes + badges del manifiesto — hoy son passthroughs a `DefaultTaskCard`.
**Aceptación:** una tarea "examen" en Academic muestra su countdown; la misma fila base en Personal no grita prioridad; metadata inválida es rechazada por Zod.

### Sprint 3 — Writing MVP *(M–L · el arquetipo más distinto = prueba del manifiesto)*
**Decisión (D12/D13):** el único pages-first; cero contadores paralelos (palabras/streaks derivados); cero tablas nuevas (sesión = focus timer + time_logs existentes).
**Pasos:**
1. Añadir valor `writing` a `templateTypeEnum` (migración) y su manifiesto (`pageRole.primary = true`).
2. Vista biblioteca: obras (folders con `kind` book/blog/comic/other + `wordGoal`) → manuscritos (pages); progreso de palabras **derivado del contenido Tiptap**.
3. Sesión de escritura sobre `FocusTimerProvider`: palabras de la sesión = word count al cerrar − al abrir; historial = `time_logs`.
4. Advisor de ventana creativa (`schedulingPreference: 'peak'`): "tu mejor ventana es 9–11am, {obra} lleva {n} días sin sesión". Streak derivado de `updatedAt`/`time_logs`.
**Aceptación:** un usuario crea una obra con meta de palabras, escribe una sesión de 45 min, y ve el progreso subir sin ningún contador persistido; el arquetipo se montó con un manifiesto + una vista, sin tablas nuevas.

**Criterio de salida de Fase 3:** Academic/Entrepreneurial/Writing hablan su vocabulario en folders/tasks/pages/CTAs · toda metadata entrante pasa por Zod discriminado · añadir un arquetipo no requiere una vista nueva · cero contadores paralelos.

---

## Fase 4 — Motor de energía visible

> **Resultado:** el diferenciador deja de ser un dato interno y se vuelve la mecánica central y visible. Es donde Kino gana la categoría, sobre datos que ya se capturan.
> **Prerrequisito:** BE-01 (conteo correcto) en Fase 0.

### 4.1 · D2 · Presupuesto de energía como primitivo del today plan
**Decisión:** el límite cuenta energía *comprometida* (completada hoy + planificada en Hoy pendiente), se muestra como barra que se llena, y el sobregiro **avisa y pide confirmación, jamás bloquea**. Es la anti-feature del task snowball de Todoist.
**Pasos:** eliminar el rechazo duro de `validateTransition` (`tasks.state-machine.ts:73-81`); calcular el presupuesto comprometido con `shared/time`; UI de barra en el today plan; diálogo de confirmación de sobregiro con copy adulto (no error rojo).
**Aceptación:** planificar la 6ª tarea que excede el límite avisa y deja continuar; el conteo respeta la tz local (UX-03 cerrado, apoyado en BE-01).

### 4.2 · Loop predicción → verificación
**Decisión:** UI sobre `predictionAccuracy` + `learningAlpha` que ya se capturan. El momento "esta app me conoce".
**Pasos:** en el Coach/dashboard, mostrar una afirmación verificada: "predije {X}, tu check-in confirmó {Y}, mi modelo mejoró {Z}%".
**Aceptación:** tras un check-in que confirma una predicción, Kino muestra la afirmación con números reales.

### 4.3 · MCP tools de calendario / time-blocking
**Decisión:** el MCP no expone bloques horarios hoy; añadirlos completa "tu agente planifica tu día respetando tu energía".
**Pasos:** tools MCP para crear/mover/consultar bloques horarios, respetando la curva de energía; mismos schemas Zod que la API.
**Aceptación:** un agente crea un bloque de deep work vía MCP y aparece en el calendario.

### 4.4 · Ritual de lunes
**Decisión:** elevar la replanificación amable (OverdueGroup + posponer en bloque + undo, ya existen) a un ritual guiado.
**Pasos:** flujo de 60s: revisar vencidas → repartir según energía prevista de la semana → confirmar.
**Aceptación:** el usuario procesa todas sus vencidas en un flujo guiado, sin la lista roja culposa.

**Criterio de salida de Fase 4:** planificar es interactuar con una barra de energía · Kino muestra al menos una afirmación verificada sobre su modelo · un agente crea bloques horarios vía MCP.

---

## Fase 5 — Go-to-market

> **Resultado:** cada arquetipo se convierte en un canal de adquisición. Depende de que existan (Fase 3).

### 5.1 · D14 · Onboarding segmentado por identidad
**Pasos:** primera pregunta "¿Qué te describe?" (Estudiante / Builder / Emprendedor / Escritor / Un poco de todo) → Kino crea el sistema del arquetipo con contenido de ejemplo realista y el tour habla su vocabulario. Resolver `profileTypeEnum` (derivar o reemplazar) al tocar onboarding.
**Aceptación:** un usuario nuevo elige "Escritor" y aterriza en una biblioteca con una obra de ejemplo y su primer capítulo.

### 5.2 · D14 · Landings por arquetipo
**Pasos:** `/para/estudiantes`, `/para/escritores`, `/para/builders` en `(marketing)`; mismo layout, copy/imágenes del segmento; SEO de nicho.
**Aceptación:** cada landing existe, es indexable y habla el idioma de su segmento.

### 5.3 · D16 · Custom configurable + empty states con vocabulario
**Pasos:** Custom permite elegir módulos del manifiesto (tabs, folder role on/off, page role); pase de empty states con "Nueva clase"/"Nueva obra"/"Nuevo milestone" según arquetipo.
**Aceptación:** un usuario compone un sistema Custom sin tocar código; cada vacío habla el idioma de su arquetipo.

**Criterio de salida de Fase 5:** onboarding por identidad poblado · al menos una landing por nicho publicada · Custom componible.

---

## Fase 6 — Por señal, no por calendario

> Nada aquí arranca por fecha; arranca cuando el uso real lo pida. Se listan para no perderlos.

- [ ] **Rumbo 07 · Captura offline** — cuando el uso mobile lo pida.
- [ ] **Vercel Blob · Upload de imágenes + KIN-56 (export con imágenes)** — cuando llegue la señal de D8 (usuarios pidiéndolo, o export sin imágenes se vuelve problema). Única compra recomendada sin dudar.
- [ ] **Rumbo 14 · GitHub sync** — `externalSource`/`externalId`/`sprints.externalId` ya sembrados a propósito; dormidos hasta aquí.
- [ ] **Búsqueda tsvector** — cuando `ILIKE` deje de servir al volumen.
- [ ] **D15 · Palanca premium** — inteligencia/AI (planificación automática, study plans), Blob, historial largo de analytics. **Nunca capar arquetipos.** Decisión de negocio del owner al activarla.

---

## Deuda que se paga "al tocar" (sin fase propia)

Se resuelven la próxima vez que un cambio toque ese archivo — no justifican una fase.

- [ ] **BE-07** — estandarizar en `getAuthContext` al tocar una ruta session-only.
- [ ] **BE-08 / AR-01** — wrapper compartido de handlers la 1ª vez que se toque un route file; migrar el resto oportunísticamente.
- [ ] **FE-05** — partir los monolitos (`tasks.hooks.ts`, `CreateTaskDialog`, `TaskDetailSheet`, `GlobalCalendarView`) al tocarlos.
- [ ] **BE-10** — reorder con un solo UPDATE (`unnest`/`CASE`) si Neon empieza a doler.
- [ ] **BE-11** — capa de servicio compartida para el MCP cuando haya tools compuestos.
- [ ] **BE-12** — rate limit real cuando haya usuarios externos.
- [ ] **AR-05** — naming (`getSystembyId`, `api_keys` snake_case, package name) en el próximo pase.
- [ ] **DB-06** — podar valores legacy de `taskTypeEnum` (`habit/todo/project`) y `banned` de `accountStatusEnum` la próxima vez que se recree/toque ese tipo. Postgres no tiene `DROP VALUE`; requiere recrear el enum (backfill + `ALTER COLUMN USING`). Inertes mientras tanto.

---

## Índice de decisiones

| # | Decisión | Fase |
|---|----------|------|
| D1 | Eliminar gamificación completa (incl. write de XP) | 1 |
| D2 | Presupuesto de energía con sobregiro suave, nunca bloqueo | 4 |
| D3 | Modelo único de borrado (`deletedAt`); `archived` fuera | 0 |
| D4 | Cron externo gratis cada 15 min para reminders con hora | 1 |
| D5 | Salud de sistemas derivada; tabla `system_health` fuera | 1 |
| D6 | Dropear columnas muertas de `user_settings` | 1 |
| D7 | Terminar recurrencia mínima; Rumbo 12 → High | 2 |
| D8 | Imágenes por URL externa (Blob diferido por señal) | 2 |
| D9 | Manifiesto de arquetipo parametriza todo | 3 |
| D10 | Folders = contenedor con nombre propio por arquetipo | 3 |
| D11 | Tasks: kinds por arquetipo, card muestra lo que importa | 3 |
| D12 | Writing: arquetipo nuevo, único pages-first | 3 |
| D13 | Pages: rol por arquetipo | 3 |
| D14 | Arquetipos como adquisición: onboarding + landings | 5 |
| D15 | Gratis mientras crecemos; premium futuro = inteligencia | 6 |
| D16 | Inbox plano; Custom configurable | 3 / 5 |

Detalle del *por qué*: D1–D8 en [`DECISIONES-2026-07.md`](./DECISIONES-2026-07.md), D9–D16 en [`DISENO-ARQUETIPOS-2026-07.md`](./DISENO-ARQUETIPOS-2026-07.md).

---

## Lo único que costaría dinero

| Gasto | Qué compra | Umbral |
|---|---|---|
| **Vercel Blob** (~centavos/GB) | Upload real de imágenes + export con imágenes (KIN-56) | Usuarios pidiéndolo, o export sin imágenes se vuelve problema. |
| **Vercel Pro** ($20/mes) | Crons por minuto, límites más altos | No antes de usuarios externos. D4 cubre el caso actual. |

Todo lo demás —incluidas las 4 innovaciones de Fase 4— se construye sobre datos y componentes que ya existen.

---

## Changelog

- **2026-07-03** — v2: reescritura a playbook ejecutable. Cada item ahora lleva decisión → pasos ordenados → criterio de aceptación. Añadida sección de Estándares de ingeniería (DoD, disciplina de migraciones, contratos). Grounding en código: `ArchetypeManifest` ya existe (KIN-122) → Fase 3 conecta, no inventa; `folders.metadata` confirmado ausente; `error.tsx`/`not-found.tsx` confirmados ausentes; FE-03 marcado para re-verificar.
- **2026-07-03** — v1: creación. Unifica los 5 docs de julio en 6 fases + deuda al tocar. Rumbo 10 absorbido por D9.
