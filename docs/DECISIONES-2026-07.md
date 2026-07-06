# Kino — Decisiones · Julio 2026

> Documento de decisión sobre los dos audits ([`AUDIT-2026-07.md`](./AUDIT-2026-07.md) y [`AUDIT-FEATURES-2026-07.md`](./AUDIT-FEATURES-2026-07.md)). Cada pregunta abierta queda decidida aquí, con el porqué y las alternativas rechazadas. Restricción dura: **cero costo monetario**; lo único de pago se señala explícitamente como opción futura (§4).

## 0. Marco de decisión

Toda decisión de abajo pasa por cuatro filtros, en este orden:

1. **Confianza en el core.** Una app de planificación vive de que el usuario confíe en lo que le muestra. Un indicador que miente (UX-01), un contador de energía corrido 4 horas (BE-01) o un recordatorio que llega tarde (UX-04) destruyen más valor que el que aporta cualquier feature nueva.
2. **El diferenciador es el motor de energía + agent-native.** Notion/Todoist/Obsidian no tienen curva de energía ni ~50 MCP tools. Todo lo que afile eso sube de prioridad; todo lo que compita donde ellos son imbatibles (bloques de editor, por ejemplo) baja.
3. **Menos peso muerto.** El schema hoy cuenta la historia de "una app gamificada abandonada a medias". Debe contar la de "una app de energía enfocada". Lo que no sirve a la tesis, se elimina — no se deja dormido.
4. **Cero costo.** Ninguna decisión de aquí requiere pagar nada. Donde existe una versión de pago mejor, se documenta el umbral en que valdría la pena (§4).

---

## 1. Las 8 decisiones de producto

### D1 · Gamificación (XP, coins, quests, inventory) → **se elimina completa, incluido el write de XP**
*Resuelve: DB-03, UX-02, KIN-105, pregunta §7.1 del audit técnico y §9.1 del de features.*

**Decisión:** eliminar `quests`, `inventory_items`, `users.coins`, `users.xpTotal` y el write en `tasks.service.ts:142-147`. También lo que el audit de features añadió al alcance: `sync_connections`, `energy_logs`, `users.lastSyncDate`, el valor `banned` del enum. Todo entra al **Rumbo 13 ampliado**.

**Por qué no reencuadrar XP como "momentum" (la alternativa de KIN-105):** momentum se puede *derivar* cuando se quiera desde datos que ya existen (tareas completadas + check-ins de energía + time logs). Un contador `xpTotal` paralelo es un segundo origen de verdad que hay que mantener sincronizado para siempre, a cambio de nada que no dé una query. Si el Coach algún día muestra momentum semanal (buena idea, fase 3), lo calcula — no lo acumula. Matar el write además elimina un UPDATE inútil en cada toggle de tarea.

**Alternativa rechazada:** construir la UI de gamificación. Contradice la identidad de Kino (adulta, anti-culpa, basada en energía real) y es el camino más caro.

### D2 · Semántica del límite de energía → **presupuesto de planificación con sobregiro suave, nunca bloqueo**
*Resuelve: UX-03, pregunta §7.2, y habilita la innovación §6.2 del audit de features.*

**Decisión:** el límite diario cuenta **energía comprometida** = completada hoy + planificada en Hoy pendiente. La UI lo muestra como una barra de presupuesto que se llena. Pasarse del límite **avisa y pide confirmación, jamás bloquea** — se elimina el rechazo duro de `validateTransition` (`tasks.state-machine.ts:73-81`).

**Por qué:** la semántica actual (contar solo lo *completado*) produce el absurdo de que mientras más productivo fuiste, menos puedes planificar — castiga exactamente el comportamiento que la app quiere premiar. Y un bloqueo duro contradice la filosofía de "replanificación amable": Kino informa el sobregiro, el adulto decide. Esta decisión convierte un bug de UX en el primitivo central del today plan (la anti-feature del task snowball de Todoist), que es justo donde Kino gana.

**Nota técnica:** el conteo además sufre BE-01 (off-by-timezone); se arregla en fase 0 independientemente de la semántica.

### D3 · Modelo de borrado → **un solo modelo: papelera vía `deletedAt`; `archived` se elimina como status**
*Resuelve: BE-02, BG-01 (el test que falla), AR-04 (el 422 fantasma), pregunta §7.3.*

**Decisión:** el borrado es `deletedAt` (papelera restaurable), único modelo. `archived` sale del status de tareas: fuera del `TRANSITION_MAP`, del schema Zod de move (`tasks.schemas.ts:96-99`) y del tool MCP `bulk_move_tasks`. Migración de datos: cualquier tarea con `status='archived'` pasa a papelera o a `completed` según tenga `deletedAt`.

**Por qué:** hoy coexisten dos semánticas a medias y ninguna funciona completa — la state machine de `soft_delete` es código muerto porque la ruta DELETE real no pasa por ella. No hay ninguna necesidad de usuario identificada para "archivado" distinta de "completada" (historial) o "papelera" (arrepentimiento). Menos estados = menos aristas = menos bugs; esto arregla de un tiro el test rojo y el 422 que el MCP puede disparar hoy.

**Alternativa rechazada:** construir `archived` como estado terminal navegable. Es especular una feature para justificar deuda existente.

### D4 · Recordatorios con hora exacta → **cron externo gratuito cada 15 min; la promesa de la UI se mantiene**
*Resuelve: BE-06, UX-04, pregunta §7.4.*

**Decisión:** mantener el cron de Vercel a las 9am local para el batch diario (due today / day before), y añadir un **trigger externo gratuito** (cron-job.org) que golpee `/api/cron/task-reminders` cada 15 minutos con el `Bearer CRON_SECRET`, procesando solo los `remind_at` exactos vencidos. Prerrequisitos técnicos (fase 0): BE-05 (no marcar como notificado si el push falló) y BE-09 (guard de existencia de `CRON_SECRET`) — sin esos dos, subir la frecuencia amplifica la pérdida de notificaciones.

**Por qué:** el plan Hobby de Vercel limita los crons a 1×/día, pero nada obliga a que el trigger venga de Vercel — el endpoint ya autentica por secret. cron-job.org es gratis, puntual y no requiere infra nueva. Degradar la promesa de la UI ("llegan por la mañana") era la otra opción gratis, pero acabas de construir el TimePicker (último commit): romper esa expectativa recién creada es peor que 20 minutos de configurar un cron externo.

**Alternativa de pago:** Vercel Pro ($20/mes) da crons por minuto. No vale la pena hoy; ver §4.

### D5 · Indicador de salud de sistemas → **se calcula on-the-fly; la tabla `system_health` se elimina**
*Resuelve: DB-04, UX-01, pregunta §7.5.*

**Decisión:** `getSystemHealthIndicator` deja de leer la tabla fantasma y calcula `daysSinceActivity` con una query real: `max(tasks.completedAt, time_logs.createdAt)` por sistema. La tabla `system_health` se dropea en Rumbo 13. El indicador y el tool MCP `find_stale_systems` pasan a decir la verdad.

**Por qué derivar en vez de poblar la tabla:** mantener una tabla denormalizada exige escribirla en cada complete/log/undo/restore — cuatro puntos de fallo nuevos para optimizar una lectura que a la escala actual es una query barata con índice. Si algún día la query duele, se materializa entonces, con datos reales de costo.

### D6 · Columnas muertas de `user_settings` → **se dropean; el pico de energía declarado contradice la tesis**
*Resuelve: DB-05, pregunta §7.6.*

**Decisión:** dropear `peakEnergyStart`, `peakEnergyEnd` y `brainDumpDefaultSystem` en Rumbo 13.

**Por qué:** `peakEnergy*` es la versión vieja de la idea — que el usuario *declare* su pico de energía. La curva predictiva con `learningAlpha` (que ya funciona y ya alimenta `EnergyCheckinForm`) lo *aprende*, que es exactamente el diferenciador. Mantener las columnas es mantener la puerta abierta a la versión peor de la feature. `brainDumpDefaultSystem` se re-crea en una migración de 2 líneas si la captura rápida algún día necesita un sistema default; guardarlo "por si acaso" es costo sin beneficio.

### D7 · Recurrencia → **se termina (Sprint A mínima) y Rumbo 12 sube a prioridad High**
*Resuelve: §3.2 y §9.2 del audit de features.*

**Decisión:** ejecutar Rumbo 12 Sprint A (recurrencia mínima: daily/weekly/monthly, generación de la siguiente instancia al completar) en la fase 2. Subir el proyecto de Low a High en Linear.

**Por qué:** "todos los lunes" es de lo primero que prueba cualquier usuario que venga de Todoist; que el campo exista en el schema y los hooks manden `null` es el peor estado posible (promesa visible sin cumplimiento). Enterrarla (Sprint B) sería coherente solo si Kino no compitiera en tareas — pero tasks es el core maduro. La versión mínima basta: no hacen falta reglas RRULE completas para cubrir el 90% de los casos.

### D8 · Imágenes en el editor → **extensión por URL externa ahora (gratis); Vercel Blob queda como la única compra recomendada a futuro**
*Resuelve: Rumbo 08.3, §9.3 del audit de features.*

**Decisión:** implementar la extensión `image` de Tiptap aceptando solo URLs externas (paste de URL de imagen) — sin upload, sin costo, esfuerzo S. Vercel Blob (upload real) se difiere hasta que exista una de dos señales: usuarios reales pidiéndolo, o KIN-56 (export con imágenes) volviéndose necesario.

**Por qué:** es lo único que le falta al editor para no sentirse "de juguete", y la versión por URL cubre el caso personal (pegar screenshots subidos a cualquier host) sin tocar billing. Es además el paso intermedio natural: la extensión de render es la misma cuando llegue el upload.

---

## 2. Plan de ejecución por fases

El orden no es negociable en un punto: **DB-01 va antes que Rumbo 13**. La limpieza de schema requiere migraciones, y con el journal desincronizado cualquier `drizzle-kit generate` produce una migración divergente o destructiva. Primero se repara la herramienta, luego se usa.

### Fase 0 — Confianza (bugs que minan el core; ~1 semana)

| Item | Qué se hace |
|---|---|
| DB-01 | Rebaseline del journal Drizzle: snapshot nuevo desde la DB real, journal re-inicializado. **Desbloquea todo lo demás.** |
| BE-01 + BG-04 + AR-02 | Crear módulo único `shared/time` (helper TS + fragmento SQL de "hoy en tz del usuario") y migrar los 4 call sites. Arregla el off-by-timezone del presupuesto de energía y el snapshot diario de una vez, en lugar de parchear cada copia. |
| FE-01 | Mover el early-return después del `useDraggable` en `GlobalCalendarView.tsx`. Fix de minutos, elimina un crash de vista completa. |
| BE-03 | Validar ownership de `parentTaskId` (+ anti-ciclo), `contextTagId`, `timeLog.systemId`, `parentPageId`. |
| BE-05 + BE-09 | Marcar como notificadas solo las tareas cuyo push resolvió; guard de `CRON_SECRET`. Prerrequisito de D4. |
| D3 (BE-02/BG-01/AR-04) | Aplicar el modelo único de borrado. La suite queda 179/179. |
| FE-02 + UX-05 | `error.tsx` global + `not-found.tsx` + los 4 `loading.tsx` faltantes. |
| FE-04 / BG-02 | Los 2 fixes de `set-state-in-effect`. Lint queda en 0 errores. |

**Criterio de salida:** `tsc` limpio, lint 0 errores, 179/179 tests, y nada en la UI muestra datos falsos… excepto el indicador de salud, que cae en fase 1.

### Fase 1 — Limpieza (Rumbo 13 ampliado + D5; esfuerzo S)

- Ejecutar Rumbo 13 con el alcance ampliado de D1 y D6: `quests`, `inventory_items`, `energy_logs`, `sync_connections`, `users.coins/xpTotal/lastSyncDate`, `peakEnergy*`, `brainDumpDefaultSystem`, enums legacy (DB-06), `banned`.
- D5: `system_health` → query derivada, tabla dropeada. El indicador vuelve a decir la verdad (cierra UX-01).
- DB-02: en la misma ventana de migración, CHECK constraint en `tasks.status`/`boardStatus` y alinear el default a `'backlog'`.
- AR-03: borrar `package-lock.json` y añadirlo a `.gitignore`.
- BE-04: envolver `createTask`/`bulkCreateTasks` en `db.transaction` (se está tocando ese flujo de todos modos por los reminders).
- D4: configurar cron-job.org cada 15 min (ya con BE-05/BE-09 resueltos). Cierra UX-04.
- Higiene Linear: marcar Rumbos 01–05 como Completed, subir Rumbo 12 a High, ampliar el alcance de KIN-102.

### Fase 2 — Calidad percibida (los gaps vs. Notion/Todoist; S–M cada uno)

En orden de impacto/esfuerzo según el audit de features:

1. **Búsqueda global** — Rumbo 11 fase 1 (`ILIKE`, KIN-88..91). El gap #1 de percepción. No esperar a tsvector.
2. **Settings completo** — cuenta, notificaciones (`notificationsEnabled` ya existe), theme (conectar `userSettings.theme`, hoy fantasma), export del workspace. La pantalla que más delata inmadurez, y la más barata de arreglar.
3. **Recurrencia** — D7, Rumbo 12 Sprint A.
4. **Imágenes por URL** — D8.
5. **Pase de empty states / micro-feedback** — consistencia de vacío/carga/error en las ~20 features.
6. FE-03 (helper compartido de derivación de status con tz), FE-06, FE-07 — los tres son primos del mismo problema de fechas; salen juntos apoyándose en `shared/time` de fase 0.

### Fase 3 — Diferenciador (donde Kino gana la categoría)

1. **Presupuesto de energía como primitivo del today plan** — la UI de D2: barra que se llena, cada tarea "cuesta", el sobregiro avisa. Es la mecánica que ni Todoist ni Notion pueden copiar sin tener el motor.
2. **Cerrar el loop predicción → verificación** — UI sobre `predictionAccuracy` + `learningAlpha` que ya se capturan: "predije X, tu check-in confirmó Y, mi modelo de ti mejoró". Es el momento "esta app me conoce" y son datos que ya existen.
3. **MCP tools de calendario/time-blocking** — hoy el MCP no expone bloques horarios; añadirlos completa el posicionamiento "tu agente planifica tu día respetando tu energía". Ninguna app del nicho lo tiene.
4. **Ritual de lunes** — replanificación guiada de 60 segundos (vencidas → repartir según energía prevista de la semana), sobre OverdueGroup + posponer en bloque + undo que ya existen.

### Fase 4 — Después (por señal, no por calendario)

- **Rumbo 10** (vistas intercambiables, M) — cuando la rigidez moleste en uso real.
- **Rumbo 07** (captura offline) — cuando el uso mobile lo pida.
- **Vercel Blob** (upload de imágenes + KIN-56) — cuando llegue la señal de D8.
- **Rumbo 14** (GitHub sync; `externalSource`/`externalId` ya sembrados a propósito — no son deuda).

### Deuda que se paga "al tocar" (sin fase propia)

BE-07 (estandarizar en `getAuthContext` cada vez que se toque una ruta session-only), BE-08/AR-01 (crear el wrapper compartido de handlers la primera vez que se toque un route file, migrar el resto oportunísticamente), FE-05 (partir los monolitos cuando un cambio los toque), BE-10 (reorder con `unnest` si Neon empieza a doler), BE-11 (capa de servicio compartida para MCP cuando haya tools compuestos), BE-12 (rate limit real si hay usuarios externos), AR-05 (naming en el próximo pase por esos archivos).

---

## 3. Tabla de disposición completa

| ID | Decisión | Fase |
|----|----------|------|
| DB-01 | Rebaseline journal Drizzle | 0 |
| DB-02 | CHECK constraint + default alineado | 1 |
| DB-03 | Eliminar (D1, Rumbo 13 ampliado) | 1 |
| DB-04 | Query derivada, tabla fuera (D5) | 1 |
| DB-05 | Dropear columnas (D6) | 1 |
| DB-06 | Limpiar enums legacy en la misma migración | 1 |
| BE-01 | Fix vía `shared/time` (AR-02) | 0 |
| BE-02 | Modelo único de borrado (D3) | 0 |
| BE-03 | Validar ownership de FKs entrantes | 0 |
| BE-04 | Transacciones en create/bulk | 1 |
| BE-05 | Marcar notificado solo si el push resolvió | 0 |
| BE-06 | Cron externo gratuito 15 min (D4) | 1 |
| BE-07 | Estandarizar `getAuthContext` al tocar | al tocar |
| BE-08 | Wrapper compartido de handlers | al tocar |
| BE-09 | Guard de `CRON_SECRET` | 0 |
| BE-10 | UPDATE único con `unnest` | al tocar |
| BE-11 | Capa de servicio para MCP | al tocar |
| BE-12 | Rate limit real | al tocar |
| FE-01 | Fix rules-of-hooks | 0 |
| FE-02 | `error.tsx` + `loading.tsx` | 0 |
| FE-03 | Helper compartido de derivación con tz | 2 |
| FE-04 | Fix set-state-in-effect | 0 |
| FE-05 | Partir monolitos al tocar | al tocar |
| FE-06 | Reusar heurística de `parseTaskDay` | 2 |
| FE-07 | Comparar con `parseTaskDay` | 2 |
| UX-01 | Se cierra con D5 | 1 |
| UX-02 | Se cierra con D1 (XP fuera) | 1 |
| UX-03 | Se cierra con D2 (presupuesto suave) | 3 (semántica), 0 (BE-01) |
| UX-04 | Se cierra con D4 | 1 |
| UX-05 | `not-found.tsx` | 0 |
| BG-01 | Se cierra con D3 | 0 |
| BG-02 | Se cierra con FE-01 + FE-04 | 0 |
| BG-04 | Se cierra con `shared/time` | 0 |
| AR-01 | Wrapper al tocar | al tocar |
| AR-02 | Módulo `shared/time` | 0 |
| AR-03 | Borrar `package-lock.json` | 1 |
| AR-04 | Se cierra con D3 (archived fuera del map) | 0 |
| AR-05 | Naming al tocar | al tocar |

---

## 4. Lo único que costaría dinero (y cuándo valdría la pena)

| Gasto | Qué compra | Umbral para pagarlo |
|---|---|---|
| Vercel Blob (~centavos/GB) | Upload real de imágenes en el editor + export con imágenes (KIN-56) | Primera de dos señales: usuarios reales pidiéndolo, o el export sin imágenes volviéndose un problema real. Es la única compra que recomendaría sin dudarlo cuando llegue la señal. |
| Vercel Pro ($20/mes) | Crons por minuto, más límites en general | No antes de tener usuarios externos. D4 (cron externo gratis) cubre el caso actual completamente. |

Todo lo demás del plan — incluidas las 4 innovaciones de fase 3 — se construye sobre datos y componentes que ya existen. El diferenciador de Kino no requiere comprar nada; requiere terminar de conectar lo que ya captura.
