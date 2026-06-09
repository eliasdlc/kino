# PLAN-09 — Auditoría de flujos, incoherencias y features rotos

> Versión: 2026-06-09
> Origen: auditoría directa del código (sin asumir nada de docs/ previos).
> Cada hallazgo incluye: **Problema**, **Dónde se genera** (archivo:línea) y **Cómo resolverlo**.
> Orden: por severidad. F1 = roto en producción, F2 = modelo incoherente,
> F3 = flujos de tareas, F4 = UI/móvil/idioma, F5 = inteligencia, F6 = limpieza.

---

## F1 — Roto en producción (features que en la práctica NO funcionan)

### 1.1 Los recordatorios push nunca se disparan ⚠️ CRÍTICO

**Problema.** Todo el sistema de notificaciones (vence hoy / vence mañana,
recordatorios a hora exacta, auto-reminders 7/3 días, escalación por prioridad)
está muerto en producción: el endpoint existe pero ningún cron lo invoca.

**Dónde.**
- `vercel.json` — solo registra `/api/cron/daily-snapshot` (12:00 UTC).
- `src/app/api/cron/task-reminders/route.ts` — existe, funciona, nadie lo llama.

**Cómo resolverlo.**
- Añadir a `vercel.json`: `{ "path": "/api/cron/task-reminders", "schedule": "0 13 * * *" }`
  (13 UTC = 9am Santo Domingo). Ojo: plan Hobby de Vercel limita crons a 1×/día;
  los recordatorios "a hora exacta" (1.3) necesitan más frecuencia → o plan Pro
  con `*/15 * * * *`, o un trigger externo (cron-job.org) con el `CRON_SECRET`.
- Verificación: crear tarea con dueDate mañana, correr el endpoint con el
  secret, confirmar push recibido y `notified_before_day = true`.

### 1.2 Las queries de recordatorios quedaron rotas por la migración dueDate→timestamptz ⚠️ CRÍTICO

**Problema.** `due_date = CURRENT_DATE` compara un `timestamptz` con un `date`:
Postgres castea el date a medianoche UTC, así que solo matchea tareas cuyo
dueDate sea *exactamente* 00:00:00 UTC. Cualquier dueDate con hora (lo que
guarda el autosave del TaskDetailSheet vía `toISOString()`) jamás dispara
recordatorio. Además el límite de día es UTC, no la timezone del usuario.

**Dónde.**
- `src/features/notifications/notifications.queries.ts:49` — `${tasks.dueDate} = CURRENT_DATE`
- `:64` — `= CURRENT_DATE + INTERVAL '1 day'`
- `:151` — escalación: `due_date <= CURRENT_DATE` (límite corrido por tz/hora).

**Cómo resolverlo.** Comparar el *día calendario en la tz del usuario*:
join a `users` y usar
`(t.due_date AT TIME ZONE u.timezone)::date = (NOW() AT TIME ZONE u.timezone)::date`
(ídem para mañana y para `<=` en escalación). Test con dueDate con hora.

### 1.3 `reconcileTaskStatuses` no se invoca nunca → los status temporales no avanzan ⚠️ CRÍTICO

**Problema.** El funnel depende de que "tomorrow" se vuelva "today" y que
"today" de ayer se recoloque. Esa función existe pero no tiene ningún call
site: una tarea programada para mañana queda en "tomorrow" para siempre salvo
que el usuario la edite; las de ayer quedan con badge "today" eternamente.
El rollover del plan (`ensureTodayPlanRolled`) solo toca `in_today_plan`,
no el status.

**Dónde.**
- `src/features/tasks/tasks.service.ts:574` — definición sin llamadas
  (verificado con grep: 0 call sites).

**Cómo resolverlo.** Mismo patrón lazy que el rollover: llamarla (gated por
una marca diaria en `user_settings`, p.ej. reutilizar/acompañar
`today_plan_date`) al inicio de `GET /api/tasks` y
`GET /api/systems/[id]/tasks`, dentro de `ensureTodayPlanRolled` o junto a él.
Importante: ejecutar reconcile **antes** del repoblado del plan para que ambos
vean el mismo día.

### 1.4 Timezone hardcodeada y derivación de status con hora del servidor

**Problema.** Dos mitades del mismo bug:
1. `users.timezone` tiene default `'America/Santo_Domingo'` y **no se setea ni
   se puede editar en ninguna parte** (ni onboarding ni settings). Para abrir
   al público, todo usuario nuevo queda anclado a SD.
2. `deriveStatusFromDate` corre en el server (Vercel = UTC) con `isToday()`
   local del proceso: crear una tarea "para hoy" después de las 20:00 hora
   local (UTC-4) la deriva a `week`/estado incorrecto, mientras el optimistic
   update del cliente (que usa hora del browser) muestra otra cosa.

**Dónde.**
- `src/shared/db/schema.ts:214-216` — default hardcodeado.
- `src/features/tasks/tasks.utils.ts:18-27` — `deriveStatusFromDate` usa reloj local del server.
- Llamada en `tasks.service.ts:304` (create) y `:389` (update).
- Onboarding (`src/features/onboarding/*`) no captura tz; Settings no la expone.

**Cómo resolverlo.**
- Capturar `Intl.DateTimeFormat().resolvedOptions().timeZone` en el cliente y
  persistirla: en `/api/onboarding/complete` (añadir campo al schema) y/o un
  PATCH en login si difiere.
- `deriveStatusFromDate(startDate, timezone)`: comparar `startDate` contra
  "hoy"/"mañana" calculados con `Intl.DateTimeFormat('en-CA', { timeZone })`,
  como ya hace `energy.service.getTodayDate`. Pasar la tz desde el service
  (ya consulta `users` en update; en create añadir el select).

---

## F2 — Modelo de estados incoherente (dos cerebros dentro de tasks)

### 2.1 El kanban Professional escribe estados que el resto de la app no entiende ⚠️ CRÍTICO

**Problema.** `SystemProfessionalView` usa las columnas de
`SYSTEM_TYPE_CONFIG.professional.statuses` (`planned`, `in-progress`,
`blocked`, `review`) y las persiste en `tasks.status` vía PATCH. La máquina de
estados global solo conoce `backlog|week|tomorrow|today|done|archived`.
Consecuencias verificadas:
- El checkbox de esas tareas en `/tasks`, dashboard y sugeridas llama a
  `POST /toggle` → `validateTransition` lanza `Cannot perform...` → la UI
  revierte **sin toast** (parece que "no hace nada").
- `insights/suggest` las excluye (filtra `today|tomorrow|week`) → el "cerebro
  de Kino" no ve nada de lo que está "en progreso".
- Cuando 1.3 se arregle, reconcile las machacaría a `backlog` (no están en
  `done/archived` y no tienen start_date).
- `TaskCard` muestra el badge fallback (texto crudo `in-progress`).
- El bypass es posible porque `updateTaskSchema.status` acepta **cualquier
  string** (`STATUS = z.string().min(1).max(50)`).

**Dónde.**
- `src/features/systems/views/SystemProfessionalView.tsx:54` (drag → `updateTask({ status })`) y `:60-61` (toggle a `'in-progress'`).
- `src/shared/lib/system-types.ts:89-96` — los statuses kanban.
- `src/features/tasks/tasks.schemas.ts:3,46` — `status: z.string()` sin enum.
- `src/features/tasks/tasks.hooks.ts:186-191` — `useToggleTask.onError` sin toast.

**Cómo resolverlo** (decisión de producto, recomendación incluida):
- **Recomendado:** el status global queda solo para scheduling. La columna
  kanban de Professional pasa a un campo propio (`metadata.kanbanColumn` o,
  mejor, alinear con la dirección "proyecto = folder" usando `folderId`).
  La vista lee/escribe ese campo; `done` sigue siendo el toggle normal.
- Endurecer `updateTaskSchema.status` a
  `z.enum(['backlog','week','tomorrow','today','done','archived'])` y migrar
  los rows existentes con estados kanban (`UPDATE ... SET status='backlog'
  WHERE status NOT IN (...)`, preservando la columna en metadata).
- Añadir toast en `useToggleTask.onError`.

### 2.2 Statuses muertos en SYSTEM_TYPE_CONFIG

**Problema.** `academic`, `entrepreneurial`, `personal` e `inbox` definen
listas de statuses (`studying`, `validating`, `paused`, `triaged`…) que
ninguna vista usa. Solo confunden y tientan a repetir 2.1.

**Dónde.** `src/shared/lib/system-types.ts:67-74,111-117,133-138,168-172`.

**Cómo resolverlo.** Borrar el campo `statuses` de los tipos que no lo usan
(tras resolver 2.1, posiblemente de todos) y quitarlo del type si queda vacío.

### 2.3 "Papelera" prometida pero inexistente + dos nociones de archivado

**Problema.**
- El delete muestra "moved to trash" con "Undo" 5s; pasado eso **no existe
  ninguna pantalla para ver o restaurar** lo borrado (`deletedAt`).
  `useRestoreTask` está definido y sin usar.
- Coexisten dos conceptos: status `archived` (vía máquina, casi inalcanzable
  desde la UI) y `deletedAt` (vía `DELETE`, que **no** cambia el status). El
  tab "Archive" muestra `done|archived`, no lo "tirado a la papelera".
- Bonus: el checkbox en Archive sobre una tarea `archived` dispara `toggle`,
  que la máquina rechaza (`archived` solo permite `soft_delete`) → revert
  silencioso (mismo síntoma que 2.1).

**Dónde.**
- `src/features/tasks/tasks.hooks.ts:251-307` (`useDeleteTaskWithUndo`), `:309-325` (`useRestoreTask` huérfano).
- `src/features/tasks/tasks.service.ts:415-435` (`deleteTask`/`restoreTask`).
- `src/features/tasks/tasks.state-machine.ts:64-66` (`archived` sin `undo`).
- `src/features/tasks/TaskArchiveView.tsx:25,55` (toggle sobre archived).

**Cómo resolverlo.**
1. Elegir un modelo: **delete = `deletedAt`** (papelera real) y **archive =
   status terminal del funnel**. No mezclar.
2. Añadir una sección "Papelera" (en `/tasks` con filtro, o tab en Archive)
   que liste `deletedAt IS NOT NULL` con botón restaurar (`useRestoreTask` ya
   existe; falta el endpoint de listado: `GET /api/tasks?deleted=true`).
3. En la máquina: permitir `archived → undo_done/move_to_backlog`, o
   deshabilitar el checkbox para `archived` en `TaskCard`.

---

## F3 — Flujos de tareas con bugs concretos

### 3.1 "Mover a mañana" del plan no mueve a mañana — corre el deadline

**Problema.** El botón del plan de hoy PATCHea `dueDate: tomorrow` +
`inTodayPlan: false`. Es decir: **cambia la fecha límite** (y resetea los
flags de notificación) en vez de la programación. El status queda `today`,
`startDate` no cambia, y el rollover de mañana repuebla por
`start_date = hoy` → la tarea **no aparece en el plan de mañana**. Resultado:
desaparece del plan y encima le moviste el deadline al usuario en silencio.

**Dónde.**
- `src/features/tasks/tasks.hooks.ts:515-542` (`useMoveToTomorrow`).
- Consumido en `src/features/dashboard/TodayPlanCard.tsx:195`.
- Repoblado del rollover: `tasks.service.ts:549-555`.

**Cómo resolverlo.** PATCH `{ startDate: tomorrow }` (el service ya deriva
status `tomorrow` y saca `inTodayPlan` vía transición o explícito) y **no
tocar `dueDate`**. `tomorrowKey()` además usa `toISOString()` (UTC): calcular
mañana en hora local del cliente.

### 3.2 No se puede quitar la fecha de una tarea

**Problema.** El botón "Clear" del TaskDetailSheet deja el estado local en
`undefined`, pero el PATCH manda `dueDate: dueDate ? ... : undefined` →
campo omitido → la DB nunca se limpia. Igual `startDate`. El schema sí acepta
`null` (`updateTaskSchema`), solo la UI no lo manda.

**Dónde.** `src/features/tasks/TaskDetailSheet.tsx:154-155,179-180`.

**Cómo resolverlo.** Mandar `dueDate: dueDate ? dueDate.toISOString() : null`
(ídem startDate) cuando el valor inicial existía y se limpió.

### 3.3 "Save & close" borra la hora del dueDate

**Problema.** El autosave manda `dueDate.toISOString()` (conserva hora), pero
`handleSave` manda `format(dueDate, "yyyy-MM-dd")`. Si pones hora y cierras
con el botón, la hora se pierde (y gana el último write, normalmente el del
botón).

**Dónde.** `TaskDetailSheet.tsx:154` (autosave, correcto) vs `:179` (botón, truncado).

**Cómo resolverlo.** Unificar a `toISOString()` en `handleSave` (o extraer un
solo builder de payload usado por ambos).

### 3.4 El autosave resetea recordatorios y flags en cada tecla

**Problema.** El autosave del sheet manda **todos** los campos (incluido
`dueDate`) cada vez que cambia cualquiera. En el service,
`data.dueDate !== undefined` ⇒ resetea `notifiedBeforeDay/DueDay/
reminderCount/lastRemindedAt` y borra+reinserta los auto-reminders. Editar el
título 3 veces = 3 resets de todo el estado de notificaciones.

**Dónde.**
- `src/features/tasks/TaskDetailSheet.tsx:144-161` — payload completo siempre.
- `src/features/tasks/tasks.service.ts:394-410` — reset incondicional si el campo viene.

**Cómo resolverlo.** Doble guard: (a) en el sheet, mandar solo campos *dirty*
(comparar contra `task`); (b) en el service, leer el `dueDate` actual (ya hace
un select de `current`) y resetear solo si el valor **cambió**.

### 3.5 Borrado instantáneo sin confirmación en vistas Professional y Entrepreneurial

**Problema.** El funnel usa ConfirmDialog + undo; estas dos vistas pasan
`useDeleteTask` directo al tacho de `TaskCard`: un click = borrado inmediato,
sin confirmación ni undo.

**Dónde.**
- `src/features/systems/views/SystemEntrepreneurialView.tsx:103,141,154`.
- `src/features/systems/views/SystemProfessionalView.tsx:29,114`.

**Cómo resolverlo.** Replicar el patrón del funnel: `useDeleteTaskWithUndo` +
`deleteTarget` + `ConfirmDialog` (copiar de `TaskBacklogView.tsx:32-83`).

### 3.6 Vista grid de /tasks: botón de borrar muerto

**Problema.** En grid, `TaskCard` recibe `onDelete={() => {}}`: el tacho se
muestra, se puede clickear, no pasa nada.

**Dónde.** `src/features/tasks/AllTasksList.tsx:102`.

**Cómo resolverlo.** Cablear `useDeleteTaskWithUndo` (necesita systemId de la
tarea: `useDeleteTaskWithUndo(t.systemId)` por fila o un hook genérico), o
no renderizar el botón en este contexto.

### 3.7 Milestones de Emprendimiento: el empty state apunta a un botón que no existe

**Problema.** La vista renderiza folders como milestones pero no hay ningún
control para crear uno; el texto promete "→ Nuevo milestone". Además el "KPI"
lee `(folder as { description?: string }).description` y la tabla `folders`
**no tiene** columna description (verificado en schema) → nunca se muestra.

**Dónde.**
- `src/features/systems/views/SystemEntrepreneurialView.tsx:118-121` (texto), `:132` (KPI muerto).
- Plomería existente: `useCreateFolder` (`folders.hooks.ts`), `POST /api/systems/[id]/folders`, patrón inline en `SystemTreeItem.tsx:77`.
- Schema: `src/shared/db/schema.ts:674-697` (folders sin description).

**Cómo resolverlo.** Botón "Nuevo milestone" con input inline (patrón
SystemTreeItem) → `useCreateFolder(system.id)`. Eliminar el display de KPI
muerto (o, si se quiere KPI de verdad: migración + schemas + input — decisión
aparte).

### 3.8 Action tab: "Daily Progress" mezcla hoy/mañana/semana

**Problema.** El progreso "diario" y las columnas incluyen `today + tomorrow +
week + done` sin distinguir el día; completar algo de la semana que viene sube
el "Daily Progress". El empty state dice "No tasks for today" aunque el tab
muestra toda la semana.

**Dónde.** `src/features/tasks/TaskActionView.tsx:81-85,144-145,137-139`.

**Cómo resolverlo.** O el progreso se calcula solo sobre `today` (+done de
hoy), o se renombra a "Progreso del funnel"; y agrupar/seccionar visualmente
por status (Hoy / Mañana / Semana) dentro de cada columna o como filtro.

---

## F4 — UI, móvil e idioma

### 4.1 Acciones invisibles en móvil (patrón hover sin fallback táctil) ⚠️ ALTA

**Problema.** `opacity-0 group-hover:opacity-100` sin variante `md:` hace que
en pantallas táctiles (sin hover) estos controles sean invisibles:
- Expandir subtareas y **borrar** en TaskCard.
- Las 3 acciones del plan de hoy (timer / mover a mañana / quitar) — el
  comentario dice "always visible on touch" pero la clase no lo implementa.
- "Agregar al plan" en sugerencias.
El timer de TaskCard sí lo hace bien (`md:opacity-0 md:group-hover:...`).

**Dónde.**
- `src/features/tasks/TaskCard.tsx:263,271`.
- `src/features/dashboard/PlanTaskRow.tsx:99`.
- `src/features/tasks/KinoSuggestedSection.tsx:113-118`.

**Cómo resolverlo.** Cambiar a `md:opacity-0 md:group-hover:opacity-100`
(visible por defecto en móvil) en los tres sitios, siguiendo el patrón ya
usado en `TaskCard.tsx:248`.

### 4.2 Spanglish sistemático

**Problema.** La app mezcla idiomas al azar: dashboard y /tasks en español;
funnel completo en inglés ("Backlog · Unscheduled tasks…", "Daily Progress",
"Move to trash", "All caught up!"); TaskDetailSheet en inglés ("Edit task",
"Save & close", "Pick date"); settings y sidebar en inglés ("Settings",
"Appearance", "Sign out", "Systems"); toasts en inglés ("added → Action tab",
"moved to trash", "Undo"); TaskCard mezcla ("overdue · due" + "Tarea").

**Dónde (lista de archivos a barrer).**
`TaskBacklogView.tsx`, `TaskPlanningView.tsx`, `TaskActionView.tsx`,
`TaskArchiveView.tsx`, `TaskDetailSheet.tsx`, `TaskCard.tsx`,
`tasks.hooks.ts` (toasts), `TasksList.tsx` (labels de tabs),
`SystemCustomView.tsx` (TAB_LABELS), `app/(app)/settings/page.tsx`,
`SystemsSidebar.tsx`, `SystemDetailHeader.tsx` ("Edit/Delete system",
"Inactive"), `ConfirmDialog` usages.

**Cómo resolverlo.** Pasada única a español (idioma del resto del producto).
Sin framework i18n por ahora; centralizar los labels repetidos (tabs del
funnel ya tienen dos fuentes: `TasksList.TAB_META` y
`SystemCustomView.TAB_LABELS` → unificar en `system-types.ts`).

### 4.3 Toast de creación refiere a tabs que no están en pantalla

**Problema.** `useCreateTask` muestra `"X" added → Action tab` aun cuando se
creó desde el QuickAdd global en dashboard o /tasks, donde no existe ningún
"Action tab".

**Dónde.** `src/features/tasks/tasks.hooks.ts:136-143`.

**Cómo resolverlo.** Mensaje neutro en español: `"X" creada · Hoy/Mañana/
Semana/Backlog` (del status real devuelto).

### 4.4 Doble fila de tabs anidadas en el detalle de sistema

**Problema.** `systems/[id]/page.tsx` monta Tabs `Tareas|Docs`, y dentro cada
vista monta **otra** TabsList (funnel de 4 tabs, o las 4 de Academic). Dos
niveles de tabs apilados sin jerarquía visual; en Academic son 2 filas + el
botón Nueva tarea.

**Dónde.** `src/app/(app)/systems/[id]/page.tsx:46-60` + `TasksList.tsx:60-72` / `SystemAcademicView.tsx:31-41`.

**Cómo resolverlo.** Aplanar: "Docs" como tab hermana dentro de la única fila
(el funnel le pasa `extraTabs`), o mover Docs a un segmento del header. De
paso borrar `SystemDetailTabs.tsx` (huérfano, 0 imports — verificado).

### 4.5 El límite diario de energía se aplica pero es invisible e ineditable

**Problema.** `validateTransition` bloquea mover a "today" si se excede
`dailyEnergyLimit` (default 50), pero: (a) no hay UI para ver ni editar el
límite (settings dice "coming soon: daily energy limit"), y (b) el error llega
como toast genérico "No se pudo mover" — el usuario no puede saber por qué.

**Dónde.**
- `src/features/tasks/tasks.state-machine.ts:79-87`.
- `src/app/(app)/settings/page.tsx:196-200` (placeholder).
- Hooks de move: el mensaje del backend se pierde (`useAdvisorAction`,
  `useMoveToTomorrow`, etc. usan mensajes fijos).

**Cómo resolverlo.** (a) Exponer el límite en Settings (PATCH a
user_settings); (b) propagar `body.message` del backend al toast en los hooks
de move; (c) traducir el mensaje del state machine.

---

## F5 — Inteligencia (energía / sugerencias / timer)

### 5.1 Las sugerencias y triggers usan la hora del servidor (UTC), no la del usuario

**Problema.** `getSuggestedTasks` calcula slot y banda de energía con
`new Date().getHours()` del server: a las 10am de Santo Domingo el server está
en `afternoon` → matchea el checkin equivocado y proyecta la curva en la hora
errónea. Mismo bug en `checkLevel1Triggers`.

**Dónde.**
- `src/features/insights/insights.service.ts:195-197`.
- `src/features/energy/energy.service.ts:306` (`checkLevel1Triggers`).

**Cómo resolverlo.** Usar `getUserTimezone` + `getCurrentHourInTz` (ya existen
en `energy.service.ts:35-58`); exportarlas o moverlas a un util compartido.

### 5.2 El recap del timer fabrica datos de sueño

**Problema.** Al terminar una sesión de foco, el quick-checkin postea
`sleepQuality: 'partial'` hardcodeado. Como el checkin es upsert por slot, una
sesión matutina puede **sobrescribir la respuesta real de sueño** del usuario.
Además `source: 'pomodoro'` se loggea para los 3 modos (pomodoro/estimated/free).

**Dónde.** `src/features/tasks/FocusTimerProvider.tsx:283` (sleepQuality) y `:260` (source).

**Cómo resolverlo.** Omitir `sleepQuality` en ese POST (si el schema de
checkin lo exige, hacerlo opcional — ya es conceptualmente solo-morning) y, en
el upsert, no pisar `sleep_quality` cuando no viene. Mapear `source` desde
`state.mode`.

### 5.3 El timer de foco se pierde con un reload

**Problema.** El estado del timer vive solo en memoria (useReducer). En PWA
móvil, un reload/kill de la pestaña mata la sesión sin registrar el tiempo
trabajado. Para una app cuyo pitch incluye foco + time-logs, es frágil.

**Dónde.** `src/features/tasks/FocusTimerProvider.tsx:200-207` (sin persistencia).

**Cómo resolverlo.** Persistir `{phase, mode, taskId, taskTitle, systemId,
startedAt, durationMs}` en localStorage en cada transición y rehidratar al
montar (recalculando expiry contra `Date.now()`); limpiar en RESET.

### 5.4 Lógica vestigial de "1×/día" en sugerencias

**Problema.** `cacheRef` se escribe pero nunca se lee con efecto; el cache
real es `staleTime: 60s`. Código muerto que aparenta una garantía que no existe.

**Dónde.** `src/features/tasks/KinoSuggestedSection.tsx:132-138,157-160`.

**Cómo resolverlo.** Borrar `cacheRef`; si se quiere 1×/día de verdad, subir
`staleTime` a `Infinity` + `gcTime` y que "Regenerar" siga invalidando.

---

## F6 — Limpieza y endurecimiento

| # | Qué | Dónde | Acción |
|---|---|---|---|
| 6.1 | Componente huérfano | `src/features/systems/SystemDetailTabs.tsx` | Borrar (0 imports) |
| 6.2 | Hook sin usar | `tasks.hooks.ts:309` `useRestoreTask` | Se usa en F2.3 (papelera); si no, borrar |
| 6.3 | Side-effects fantasma | `tasks.state-machine.ts:26-29` (`update_sort_index`, `update_system_health`, `generate_next_rrule_instance`) — se generan y el switch del service los ignora | Quitarlos del builder hasta que existan |
| 6.4 | Tipo "Hábito" sin recurrencia | `task-type-config.ts:75-86`; `recurrenceRule` no se escribe en ningún sitio (solo se lee en `tasks.service.ts:81`) | Quitar `habit` del TaskTypePicker (o implementar recurrencia mínima — decisión de producto) |
| 6.5 | SQL con interpolación de IDs | `notifications.queries.ts:182-187` `updateTaskEscalation` | Reescribir con `inArray` de drizzle |
| 6.6 | Polling agresivo | `tasks.hooks.ts:29,42` (`refetchInterval: 5_000`) + `useSubtasks` 5s **por tarjeta** | Subir a 30-60s o `refetchOnWindowFocus`; subtasks solo `enabled` al expandir |
| 6.7 | Seed cruzado de cache | `folders/[folderId]/page.tsx` pasa `folderTasks` como `initialData` *del sistema* a `TasksList` → `['tasks','system',id]` se siembra solo con las del folder | Pasar `initialData` real del sistema o `[]` |
| 6.8 | Comparación de fechas por string | `KinoSuggestedSection.tsx:96` `task.dueDate < toISOString().slice(0,10)` (timestamptz vs date-string, UTC) | Usar `differenceInCalendarDays(parseDueDate(...))` como TaskCard |
| 6.9 | Settings placeholder | `settings/page.tsx:196-200` "coming soon" | Resolver con F4.5 o quitar el bloque |

---

## Orden de ejecución sugerido

1. **F1 completo** (1.1 → 1.4). Sin esto, recordatorios y funnel temporal
   simplemente no funcionan. Son cambios chicos y de alto impacto.
2. **F2.1** (kanban Professional) — requiere decisión de producto primero
   (metadata.kanbanColumn vs folders); F2.3 (papelera) puede ir en paralelo.
3. **F3** — todos son fixes puntuales e independientes entre sí; 3.1 y 3.2
   primero (corrompen datos del usuario).
4. **F4.1** (móvil) y **F4.2** (idioma) — alto impacto percibido, riesgo nulo.
5. **F5** y **F6** al final.

## Regla de verificación

Cada ítem se cierra ejecutando su escenario real en la app (no solo
typecheck): p.ej. 3.1 = poner tarea en plan → "mover a mañana" → confirmar que
mañana aparece en el plan y que el dueDate NO cambió.
