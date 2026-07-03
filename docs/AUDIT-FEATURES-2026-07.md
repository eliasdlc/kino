# Kino — Audit de features · Julio 2026

> Audit de producto: inventario de features y su estado real, features muertos, código programado sin usar, gaps de calidad frente a Notion/Todoist/Obsidian, e ideas de innovación. Complementa el audit técnico de bugs/deuda en [`AUDIT-2026-07.md`](./AUDIT-2026-07.md).
>
> Fuentes cruzadas: `src/shared/db/schema.ts` (fuente de verdad de features), código de `src/features/` y `src/app/api/`, y los 14 proyectos "Rumbo" con 121 tickets en Linear (team KIN).

---

## 1. Mapa de features y su estado real

| Feature | Estado | Evidencia |
|---|---|---|
| Tasks (CRUD, state-machine, bulk, triage, undo) | **Vivo y maduro** | 64 archivos en `features/tasks/`, optimistic UI, multi-select con teclado (KIN-23..31) |
| Systems (5 vistas por tipo, board doble-eje, sprints, epics) | **Vivo y maduro** | `features/systems/views/`, Rumbo 09 completo |
| Notebooks/Pages (Tiptap: tablas, slash, paste, shortcuts) | **Vivo, 90%** | Rumbo 08: falta Sprint 3 (imágenes, KIN-70..72, bloqueado por billing de Vercel Blob) |
| Energía (check-ins, curva, advisor, planner) | **Vivo** | `features/energy/` con tests; `EnergyCheckinForm` ya usa la curva predictiva |
| Calendario global + time-blocking + sugerencia por energía | **Vivo** | Rumbo 04 completo (KIN-32..40), incluye overlay de energía |
| Coach/Insights ("Inteligencia visible") | **Vivo** | `CoachPanel.tsx` consumido en dashboard y tasks page (Rumbo 02 completo) |
| NL parser español (fecha, prioridad, #sistema, @tag, duración) | **Vivo** | Rumbo 01 completo (KIN-5..13) |
| Export MD/JSON/ZIP | **Vivo** | Rumbo 06 completo; falta KIN-56 (imágenes, depende de Rumbo 08.3) |
| Sticky notes (anchoring, stacks, posicionamiento en márgenes) | **Vivo** | Schema elaborado y usado |
| MCP server (~50 tools) + OAuth provider + API keys | **Vivo** | Diferenciador real: pocas apps del nicho lo tienen |
| Push notifications + cron de reminders | **Vivo** | `api/cron/task-reminders`, `api/push/*` |
| Focus timer / pomodoro + time logs | **Vivo** | `FocusTimerProvider`, `time_logs` con source pomodoro/manual/timer |
| Marketing site + onboarding + docs | **Vivo** | route group `(marketing)` |

La base es mucho más sólida de lo que sugiere la fase "deuda". Lo que sigue es lo que sobra y lo que falta.

## 2. Features muertos (0 usos fuera del schema, verificado con grep word-boundary)

Corresponde al **Rumbo 13** (KIN-100..105, todo en Backlog pese a que la decisión ya está tomada). La verificación de hoy confirma y **amplía** ese plan:

| Elemento muerto | En el plan de Rumbo 13 | Nota |
|---|---|---|
| `quests` + `questTypeEnum` + `frequencyEnum` | Sí | Ojo: un grep ingenuo matchea "re**quest**"; verificar con word-boundary |
| `inventoryItems` + `itemTypeEnum` | Sí | — |
| `users.coins` | **No — añadir a KIN-102** | 0 usos |
| `syncConnections` + `syncProviderEnum` completo | **No — ampliar alcance** | Tabla entera muerta (google_calendar, jira, slack, teams, notion, ical, github) |
| `energyLogs` | **No — ampliar alcance** | Superseded por `energy_checkins` |
| `users.lastSyncDate` | **No** | 0 usos |
| `accountStatusEnum` valor `banned` | **No** | 0 usos |

**Recomendación:** ejecutar Rumbo 13 ya (esfuerzo S), ampliando su alcance con `coins`, `syncConnections`, `energyLogs` y `lastSyncDate`. Es la limpieza más barata con más retorno conceptual: el schema pasa de "app gamificada abandonada a medias" a "app de energía enfocada".

## 3. Features a medias (programado pero sin usar, o vivo pero invisible)

1. **XP** — `tasks.service.ts:145` suma `xpTotal` al completar, pero cero componentes lo muestran. El usuario gana XP hacia la nada. KIN-105 pregunta exactamente esto — decisión de producto. Opciones: mostrarlo como "momentum semanal" en el Coach (reencuadre barato, sin gamificación infantil), o eliminar la escritura.
2. **Recurrencia** — `recurrenceRule`/`recurrenceParentId` en schema; el service solo calcula un flag `isRecurring` (`tasks.service.ts:91`) y los hooks siempre mandan `null` (`tasks.hooks.ts:128`). Es el limbo que Rumbo 12 declara inaceptable. Recomendación: **Sprint A (terminar mínima)**, no enterrar — "todos los lunes" es de lo primero que un usuario de Todoist prueba.
3. **Theme** — `userSettings.theme` (dark/light/system) existe en schema y settings API, pero la página de Settings solo tiene `EnergyLimitSection` y `TimezoneSection`. Preferencia fantasma (o hay un toggle que no pasa por esta columna).
4. **`tasks.externalSource`/`externalId` + `sprints.externalId`** — sembrado GitHub-ready a propósito (documentado en el schema). No es deuda; dormido hasta el bloque GitHub (Rumbo 14).
5. **Settings en general** — la superficie más pobre de la app: 2 secciones. Falta gestión de cuenta, notificaciones (existe `notificationsEnabled` en schema), export del workspace, theme. Para percepción de calidad "Notion-level", Settings es de las primeras pantallas que delatan una app inmadura.

## 4. Desalineación Linear ↔ realidad

- **Rumbos 02, 03, 04 y 05**: todos sus tickets Done pero los proyectos siguen "Backlog" en Linear → marcar Completed.
- **Rumbo 01**: 9/9 Done pero el proyecto está "In Progress" → cerrar.
- **Rumbo 08**: correctamente "In Progress" (Sprint 3 de imágenes pendiente).
- Backlog real restante: **07 (offline), 10 (vistas), 11 (búsqueda), 12 (recurrencia), 13 (limpieza), 14 (futuro)** — 41 tickets.

## 5. Mejoras concretas (gaps de calidad vs. Notion/Todoist/Linear-app)

Ordenadas por impacto percibido / esfuerzo:

1. **Búsqueda global (Rumbo 11) — gap #1 de percepción de calidad.** En Notion, Cmd+K encuentra todo; en Kino el palette solo navega sistemas. Con el volumen actual, la fase `ILIKE` (KIN-88..91) basta y es esfuerzo S — no esperar a tsvector.
2. **Vistas intercambiables (Rumbo 10).** La rigidez "el tipo de sistema dicta la vista" es la misma rigidez metodológica que Kino critica de otras apps. Las 5 vistas ya existen desacopladas; es plumbing.
3. **Keyboard-first en todas partes.** Ya hay x/shift+j/k en triage — extender el estándar a editor, board y calendario. La sensación "Linear-quality" viene de que nada requiera mouse.
4. **Settings completo** (ver §3.5). Barato y muy visible.
5. **Imágenes en el editor (Rumbo 08.3).** Lo único que le falta al editor para no sentirse "de juguete" frente a Notion. Bloqueado por billing de Blob. Alternativa sin costo: aceptar solo URLs externas de imagen como paso intermedio (extensión image sin upload).
6. **Empty states y micro-feedback.** Con ~20 features, la consistencia de estados vacíos/carga/error es lo que separa "app de un dev" de "producto". Vale un pase dedicado.

## 6. Innovación — cómo Kino le gana a Notion/Obsidian/Todoist

La tesis ya está en los Rumbos: **el diferenciador es el motor de energía**, que ninguna de las tres tiene. Encima de lo planeado:

1. **Cerrar el loop predicción → verificación.** Ya existen `predictionAccuracy` en `energy_checkins` y `learningAlpha` en el perfil. Innovación visible: que Kino diga "te sugerí deep work a las 9am, lo hiciste, tu check-in confirma que acerté — mi modelo de ti mejoró 4%". Notion nunca podrá decir eso. Es UI sobre datos que ya se capturan.
2. **Presupuesto de energía del día como primitivo de planificación.** `dailyEnergyLimit` existe. Convertirlo en la mecánica central del today plan: cada tarea "cuesta" energía, el plan de hoy es una barra que se llena, y arrastrar la 6ª tarea avisa del sobregiro. Ataca el problema que Todoist agrava (la lista infinita culposa); es la anti-feature del task snowball.
3. **El MCP como categoría, no como feature.** Ya hay ~50 tools + OAuth. Ninguna app personal de productividad es hoy "agent-native" en serio. Posicionamiento: *tu agente puede planificar tu día respetando tu curva de energía*. Añadir al MCP las tools de calendario/time-blocking (hoy no expone bloques horarios) lo haría único.
4. **Replanificación amable como identidad de marca.** Ya construida (OverdueGroup + posponer en bloque + undo). Elevarla: el "lunes por la mañana" de Kino como ritual guiado de 60 segundos (revisar vencidas → repartir según energía prevista de la semana). Todoist muestra 40 vencidas en rojo; Kino las replanifica sin culpa.
5. **Contra Obsidian/Notion en notas: no competir en features, competir en integración.** El editor nunca alcanzará a Notion en bloques. Pero Notion no conecta notas↔tareas↔energía↔tiempo. `task_page_links` + sticky notes ancladas ya son la base; innovación: que una página de proyecto muestre "tiempo real invertido vs. estimado" desde `time_logs` sin configurar nada.

## 7. Orden de ejecución recomendado

1. Rumbo 13 ampliado (limpieza, S)
2. Rumbo 12 Sprint A (recurrencia mínima, S–M)
3. Rumbo 11 fase 1 (búsqueda ILIKE, S)
4. Settings completo + theme (S)
5. Rumbo 10 (vistas intercambiables, M)
6. Rumbo 08.3 o su alternativa sin Blob (imágenes)
7. Rumbo 07 (captura offline)
8. Loops de energía de §6 (predicción→verificación, presupuesto de energía)
9. Rumbo 14 (diferenciadores caros)

## 8. Riesgos y notas

- `insights.service.ts:186` tiene un `TODO Fase 4` sobre estados de task — verificar que no quedó obsoleto tras la state-machine actual.
- Solo 1 TODO en todo el codebase: buena higiene, pero la deuda vive en el schema, no en comentarios (por eso este audit se hizo por schema).
- Rumbo 12 tiene prioridad Low en Linear; para paridad con Todoist debería ser High (decisión de producto).
- El audit técnico hermano (`AUDIT-2026-07.md`) encontró además: `system_health` se lee pero nada lo escribe (DB-04 — el indicador de salud miente), journal de migraciones Drizzle desincronizado (DB-01), y columnas muertas extra en `user_settings` (`brainDumpDefaultSystem`, `peakEnergyStart/End`, DB-05) que también deberían entrar al alcance ampliado de Rumbo 13.

## 9. Decisiones de producto pendientes (solo del owner)

1. ¿XP se reencuadra (momentum en Coach) o se mata? (KIN-105)
2. ¿Recurrencia se termina (Sprint A) o se entierra (Sprint B)? (Rumbo 12)
3. ¿Se paga Vercel Blob para imágenes o se acepta el paso intermedio de URLs externas? (Rumbo 08.3)
