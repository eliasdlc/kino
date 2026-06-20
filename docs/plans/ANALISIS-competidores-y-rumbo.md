# ANÁLISIS — Problemas de Notion / Todoist / TickTick / Obsidian y el rumbo de Kino

> Tipo: documento de estrategia de producto (no es un plan de ejecución).
> Versión: 2026-06-19
> Autor del análisis base: Elías (notas de visión) + auditoría de código.
> Estado: borrador para pulir el rumbo. No implementar nada de aquí sin un PLAN dedicado.

---

## 0. Cómo leer este documento

Para cada problema de la competencia hay un bloque con el mismo formato:

- **Kino hoy** — qué hay de verdad en el código (no en docs viejos), 1 línea.
- **3 soluciones** — opciones reales, no genéricas.
- **Recomendación** — cuál tomar y por qué.
- **Esfuerzo** — S (sesión), M (varias sesiones), L (proyecto grande).
- **Riesgos** — qué se puede romper o complicar.
- **Encaje** — cómo entra en la arquitectura actual.

Al final: **features nuevos**, **features a mejorar (actuales)** y un **rumbo priorizado**.

---

## 1. Estado real de Kino (verificado en código, 2026-06-19)

Esto corrige varios supuestos de tus notas. Es la base de todo lo demás.

| Área | Realidad en código | Implicación |
|---|---|---|
| **Editor de cuadernos** | Tiptap/ProseMirror. Se guarda como **HTML** (`editor.getHTML()`), no markdown. Extensiones: StarterKit, Typography, Placeholder, StickyAnchorMark. **Sin tablas, sin imágenes.** Autosave debounce 1.5s. | Tu plan de "exportar a .md" y "alejarse de md" parte de una premisa falsa: **ya no usas md**. El problema real es que el formato de origen es HTML libre, difícil de exportar limpio y sin tablas. |
| **Offline** | SW (`kino-sw.js`) solo hace *network-first con fallback a `/offline`* en navegación. **No hay** cola de mutaciones, IndexedDB, ni persistencia de TanStack Query. `next-pwa` instalado pero no se usa para esto. | "Modo offline" hoy es ~0%. Cualquier promesa offline es trabajo nuevo de verdad. |
| **Inteligencia** | `energy/advisor/insights` existen en backend (patrones: overload/abandonment/disorganization/underuse con scoring). `insights.service` **no se consume en ningún `.tsx`**. | Sigue vigente "dos cerebros desconectados". El valor diferenciador está construido pero invisible. |
| **Tareas** | Doble estado: `status` (scheduling: backlog/week/tomorrow/today/done/archived) + `board_status` (kanban project). `parentTaskId` (subtasks + epics). `recurrenceRule` a medias. **No hay dependencias** (`blockedBy`/`blocks`). | Jerarquía real existe a nivel datos; dependencias no. |
| **Stack** | Next 16 App Router, Drizzle + Postgres (Neon), Better Auth, TanStack Query v5, Zustand, Tailwind+shadcn, Vercel. MCP ~50 tools. | Local-first/offline encaja con TanStack persist; imágenes con Vercel Blob; el MCP es un activo de exportación/integración infravalorado. |
| **Captura rápida** | `GlobalQuickAddDialog` (Zustand store), parser de fechas en español (`quick-date-parse.ts`). | Base de "fast input" ya existe; falta el lado de **organización** masiva. |
| **Vistas** | 5 vistas por `system_type` (academic, entrepreneurial, project/kanban, custom, detail). Planning, Calendar (por sistema), Backlog, Archive. **No hay calendario global.** | Time-blocking y calendar integrations dependen de construir esa vista global primero. |

**Conclusión transversal:** Kino no compite por *tener más features* que Notion. Compite por **exponer bien la inteligencia que ya tiene** y por **fricción cero de captura→organización**. Casi todo lo de abajo refuerza esos dos ejes.

---

# SECCIÓN A — NOTION

## A1. Rendimiento móvil (web wrapper lento)

**Kino hoy:** PWA real con Next App Router; el cuello no es "web wrapper" (Kino sí es web nativo en navegador), sino payloads y re-render en sistemas grandes (ver A5).

- **Sol 1 — Presupuesto de rendimiento + virtualización:** listas largas (tareas, páginas, board) con `@tanstack/react-virtual`; lazy-load de vistas pesadas con `next/dynamic`. Medir con un budget fijo (LCP/INP).
- **Sol 2 — Datos incrementales:** paginar/segmentar queries por sistema y por estado; no traer todas las tareas de un sistema de golpe. Prefetch de la vista probable.
- **Sol 3 — Skeleton + optimistic UI agresivo:** que toda mutación se sienta instantánea (TanStack optimistic) aunque el server tarde; nunca bloquear input por red.

**Recomendación:** Sol 3 ahora (barato, gran impacto percibido) + Sol 1 cuando aparezcan listas >100. Sol 2 cuando llegue el offline (comparten infraestructura de caché).
**Esfuerzo:** S (Sol 3) / M (Sol 1).
**Riesgos:** optimistic UI mal hecho deja estados inconsistentes; necesita rollback claro en `onError`.
**Encaje:** TanStack Query v5 ya soporta optimistic e infinite queries; encaja sin librerías nuevas salvo react-virtual.

## A2. Ausencia de modo offline

**Kino hoy:** ~0% offline real (ver §1).

- **Sol 1 — Offline de lectura + cola de escritura (pragmático):** persistir el cache de TanStack en IndexedDB (`persistQueryClient` + `idb-keyval`); encolar mutaciones offline y reproducirlas al reconectar (TanStack `onlineManager` + mutation defaults con retry). Last-write-wins por `updatedAt`.
- **Sol 2 — Local-first completo (sync engine):** adoptar un motor (ej. Replicache/ElectricSQL/PowerSync) con DB local y sync bidireccional. Offline total, multi-dispositivo real.
- **Sol 3 — Solo "captura offline":** que únicamente crear tarea/sticky/nota funcione offline (cola), y todo lo demás muestre estado degradado. Mínimo viable psicológico ("nunca pierdo un pensamiento").

**Recomendación:** **Sol 3 → Sol 1** por fases. Empieza por captura offline (resuelve el 80% del dolor emocional de Todoist/Notion) y crece a lectura+cola. **Sol 2 es L y un cambio de arquitectura** que choca con tu deuda actual; reservarlo para la versión Desktop.
**Esfuerzo:** S (Sol 3) / M (Sol 1) / L (Sol 2).
**Riesgos:** conflictos de merge (sticky notes con posición, board moves); el doble-estado de tareas (`status` derivado de fecha en server) es delicado offline — la derivación de status tendría que correr también en cliente o reconciliarse.
**Encaje:** Sol 1/3 viven sobre TanStack Query (ya lo tienes). No requieren tocar el schema. Documenta esto como sucesor real de PLAN-03 (sync), que asumía otra cosa.

## A3. Complejidad abrumadora / parálisis por análisis

**Kino hoy:** sistemas predefinidos por `system_type` ya combaten esto (es tu mejor ventaja estructural). Riesgo: el funnel de 4 estados + doble eje de board puede confundir si no se enseña.

- **Sol 1 — Onboarding por intención:** "¿qué quieres organizar?" → crea el sistema con su vista ya lista. Menos pantalla en blanco.
- **Sol 2 — Plantillas de sistema:** sistemas pre-poblados (estudio, proyecto, hábitos) con tareas/secciones ejemplo borrables. Arrancas trabajando, no configurando.
- **Sol 3 — Progressive disclosure:** ocultar profundidad (epics, sprints, board_status) hasta que el usuario la necesita; mostrar solo lo básico por defecto.

**Recomendación:** las tres son coherentes y se refuerzan; **Sol 2 es la de mayor ROI** y conecta con tu idea de plantillas de cuaderno. Sol 3 es la guardia contra que "exponer inteligencia" se vuelva ruido.
**Esfuerzo:** M.
**Riesgos:** plantillas que se sienten genéricas; hay que curarlas bien o estorban.
**Encaje:** `system_type` ya determina vista; una plantilla = `system_type` + seed de tareas/páginas. Reutiliza el seeding que ya haces al crear sistema `project` (categorías bug/feature/chore).

## A4. "Aprendiz de todo, maestro de nada"

**Kino hoy:** alineado con tu visión ("maestro de lo suficiente"). El riesgo es scope creep al copiar features.

- **Sol 1 — Carta de no-objetivos explícita:** documentar qué Kino *no* hará (fórmulas tipo Excel, automatizaciones tipo Jira, wiki infinito). Filtro para decir que no.
- **Sol 2 — Profundizar 3 verticales, no 10:** elegir y pulir (tareas+energía, cuadernos, proyectos/kanban) hasta que sean claramente mejores que el equivalente recortado de Notion.
- **Sol 3 — Medir "tiempo a primer valor":** métrica norte (crear y completar algo útil en <2 min) en vez de "número de features".

**Recomendación:** Sol 1 como documento vivo (esto mismo puede ser su germen) + Sol 2 como criterio de roadmap. Sin acción de código.
**Esfuerzo:** S.
**Riesgos:** ninguno técnico; el riesgo es no respetar la carta cuando llegue la tentación de copiar.
**Encaje:** N/A (proceso).

## A5. Degradación en workspaces grandes

**Kino hoy:** sin virtualización ni paginación; queries que pueden traer todo el sistema. No probado a escala.

- **Sol 1 — Virtualización + paginación por estado** (igual que A1 Sol 1/2).
- **Sol 2 — Búsqueda indexada server-side:** endpoint de búsqueda (Postgres full-text / `tsvector`) sobre tareas y páginas, en vez de filtrar en cliente. Resuelve el item 4 del backlog UX.
- **Sol 3 — Índices y conteos materializados:** contadores por sistema (tareas activas, etc.) precalculados para no escanear en cada render.

**Recomendación:** **Sol 2 primero** (búsqueda global es además una feature muy pedida y "Linear-like"), luego Sol 1. Sol 3 solo si se ve lentitud medida.
**Esfuerzo:** M (Sol 2).
**Riesgos:** mantener el índice fts sincronizado; con Drizzle hay que añadir columnas `tsvector` + trigger o generar en query.
**Encaje:** Postgres ya tiene fts nativo; el command palette ya existe como hogar natural de la búsqueda global.

## A6. Vendor lock-in / privacidad / exportación

**Kino hoy:** sin exportación. Datos en Postgres propietario (tu server). Cuadernos en HTML.

- **Sol 1 — Exportar por entidad:** botón "exportar" en cuaderno/sistema/tarea → genera Markdown (de HTML vía `turndown`) y/o JSON, descarga directa. Cubre tu pedido explícito.
- **Sol 2 — Export masivo del workspace:** ZIP con todo (cuadernos .md, tareas .json, estructura de carpetas) tipo "export de Notion" pero limpio.
- **Sol 3 — API/MCP como salida de datos:** el MCP (~50 tools) ya *es* acceso a datos; documentarlo como mecanismo de portabilidad ("tus datos son consultables por agentes/tú").

**Recomendación:** **Sol 1 ya** (es pedido concreto y diferenciador honesto), **Sol 2 después**. Sol 3 es marketing gratis: ya lo tienes, solo comunícalo.
**Esfuerzo:** S (Sol 1, una entidad) / M (Sol 2, ZIP + carpetas).
**Riesgos:** HTML→MD pierde cosas (sticky anchors, futuras tablas). Define qué se preserva. E2E encryption es L y choca con que el server procesa datos (energía, crons) — **no lo prometas aún**.
**Encaje:** `turndown` en cliente; el endpoint puede stremear el ZIP (Vercel Functions soportan streaming). Carpetas ya existen como entidad.

## A7. Bloatware / saturación de UI

**Kino hoy:** UI relativamente limpia; el riesgo aparece justo al "exponer inteligencia" (decisión de fase de deuda). Tensión real ya identificada en memoria.

- **Sol 1 — Inteligencia bajo demanda:** insights/advisor en un panel colapsable o en el dashboard, no incrustados en cada vista. Señal, no ruido.
- **Sol 2 — Densidad configurable:** un setting "modo simple / modo completo" que esconde epics/sprints/board para quien no los usa (= A3 Sol 3).
- **Sol 3 — Una sola superficie de "consejo":** en vez de N badges, un único lugar ("Hoy/Coach") donde Kino habla. Evita la metástasis visual de Todoist.

**Recomendación:** Sol 3 como principio rector al exponer inteligencia + Sol 1. Esto es el *cómo* correcto de la decisión "exponer inteligencia" sin caer en bloatware.
**Esfuerzo:** M (ligado a la feature de inteligencia).
**Riesgos:** el de siempre: confundir profundidad con desorden.
**Encaje:** `insights.service` ya produce los datos; falta una sola superficie consumidora (no diez).

## A8. Edición de texto deficiente (selección, copy/paste, RTL)

**Kino hoy:** Tiptap/ProseMirror — esto es justamente lo que *bien configurado* resuelve los dolores de Notion. Falta: slash-menu, atajos, paste limpio, quizá RTL.

- **Sol 1 — Slash command menu + atajos de bloque:** `/` para insertar bloques, Markdown shortcuts (ya parcial con Typography). Escritura fluida sin ratón.
- **Sol 2 — Paste handler robusto:** sanitizar/normalizar HTML pegado (Tiptap permite `transformPastedHTML`) para que copiar de la web no rompa formato.
- **Sol 3 — Bloques que faltan:** tablas (`@tiptap/extension-table`), imágenes (A-Obsidian4), code blocks con highlight, callouts.

**Recomendación:** Sol 1 + Sol 2 son el corazón de "escribir se siente bien" y son **tu ventaja sobre Notion** (Tiptap es mejor base que su editor). Sol 3 por prioridad: tablas e imágenes primero.
**Esfuerzo:** M.
**Riesgos:** cada extensión añade peso al bundle del editor; lazy-load. RTL es nicho — no priorizar salvo demanda.
**Encaje:** todo es config/extensiones Tiptap sobre `EditorContext.tsx`. Cero cambio de datos (salvo que tablas/imágenes cambian el HTML guardado).

## A9. Integraciones cerradas / Google Calendar

**Kino hoy:** sin integraciones de calendario; no hay vista de calendario global aún (tu nota lo confirma).

- **Sol 1 — Primero la vista de calendario global, luego sync:** construir el calendario unificado dentro de Kino (todas las tareas con fecha). Sin eso, ninguna integración tiene sentido.
- **Sol 2 — Suscripción iCal de salida (read-only):** exponer un feed `.ics` de tus tareas → se ve en Google/Apple Calendar. Una vía, simple, sin OAuth.
- **Sol 3 — Sync bidireccional Google Calendar:** OAuth + push de eventos. Potente pero es L y duplica el dolor de Notion si se hace a medias.

**Recomendación:** **Sol 1 → Sol 2**. La vista global es prerrequisito de todo time-blocking; el feed iCal da 80% del valor con 20% del esfuerzo y sin el infierno de la sync bidireccional.
**Esfuerzo:** M (vista) / S (iCal out) / L (bidi).
**Riesgos:** bidi genera duplicados/loops (el dolor exacto que critican de Notion). No entres ahí hasta tener la vista madura.
**Encaje:** fechas ya son `timestamptz` con hora opcional (`hasDueTime`); un endpoint `.ics` es trivial de generar. Cuidado con la convención de tz del usuario (ver project-date-convention).

---

# SECCIÓN B — TODOIST / TICKTICK

## B1. Paywall de funciones esenciales

**Kino hoy:** sin billing (es roadmap). Tu postura: core completo gratis, pago opcional, eventual open source.

- **Sol 1 — Definir la línea core/pago por valor, no por traba:** todo lo que cumple la promesa (capturar, organizar, recordar, energía) gratis; pago = nube extra, colaboración, Desktop.
- **Sol 2 — Sin límites artificiales:** no limitar nº de tareas/sistemas/recordatorios. Esos límites son justo lo que la gente odia.
- **Sol 3 — Open-core explícito:** comunicar desde ya el plan open source; convierte la postura en marketing.

**Recomendación:** las tres son tu visión; documentarlas como política de monetización. Sin código ahora.
**Esfuerzo:** S (doc).
**Riesgos:** prometer "para siempre gratis" cosas que cuestan server (push, crons). Sé específico sobre qué es gratis.
**Encaje:** N/A.

## B2. Bola de nieve de vencidas (estrés / fatiga de alertas)

**Kino hoy:** status se deriva de fecha; hay rollover/reconciliación. Recordatorios por push (cron + GH Actions cada 15 min). No sé si hay "replanificar en bloque".

- **Sol 1 — Replanificación en un toque:** acción "posponer todo lo vencido a hoy/mañana/esta semana" y por-tarea swipe rápido. Mata el tedio de reprogramar 20 tareas.
- **Sol 2 — Sin badges rojos acumulativos:** en vez de contador de vencidas que castiga, un encuadre amable ("3 cosas pendientes de ayer, ¿las muevo?"). Acción, no culpa.
- **Sol 3 — Auto-rollover inteligente:** lo vencido no se pinta de rojo eterno; se ofrece reagrupar usando energía/carga del día (aquí entra el advisor).

**Recomendación:** **Sol 1 (acción masiva de posponer) + Sol 2 (lenguaje)** son tu mayor diferenciador psicológico declarado ("Kino nunca debe abrumarte"). Sol 3 conecta esto con la inteligencia.
**Esfuerzo:** M.
**Riesgos:** auto-mover fechas sin consentimiento erosiona confianza; siempre proponer, no imponer (regla de oro del advisor).
**Encaje:** ya tienes la lógica de status-por-fecha y `dayToLocalISO`; el bulk reschedule reusa `bulk_update_tasks` (existe en MCP) y el patrón de DnD de planificación.

## B3. Sync rota entre dispositivos

**Kino hoy:** PWA → un solo origen, no hay problema de sync hoy. Se vuelve crítico con Desktop (tu nota lo dice).

- **Sol 1 — No introducir el problema:** mantener server-as-source-of-truth mientras sea PWA; invalidación correcta de TanStack tras mutación.
- **Sol 2 — Realtime opcional:** SSE/WebSocket para reflejar cambios entre pestañas/dispositivos abiertos (útil ya, no solo Desktop).
- **Sol 3 — Diseñar la sync con el offline (A2):** que la cola de mutaciones + persistencia *sea* el mecanismo de sync para Desktop. Una sola inversión.

**Recomendación:** Sol 1 ahora; **Sol 3 cuando hagas offline/Desktop** (no construyas sync dos veces). Sol 2 es un plus barato si quieres "seamless" antes.
**Esfuerzo:** S (Sol1) / M (Sol2) / L (Sol3=A2).
**Riesgos:** realtime mal hecho = parpadeos/condiciones de carrera.
**Encaje:** TanStack invalidation ya cubre lo básico. SSE encaja con Vercel Functions (streaming).

## B4. NLP inconsistente (sobre todo fuera del inglés)

**Kino hoy:** **ya tienes parser de fechas en español** (`quick-date-parse.ts`: hoy/mañana/días/“a las 5”/“5pm”). Es justo donde Todoist falla.

- **Sol 1 — Ampliar el parser determinista:** añadir prioridad ("!1", "urgente"), proyecto/sistema ("#estudio"), etiquetas ("@casa"), duración ("30min"). Sigue siendo puro y testeable.
- **Sol 2 — Parser + preview editable (ya lo haces):** mantener el chip de preview con "ignorar"; extenderlo a los nuevos campos. El usuario siempre ve qué entendió.
- **Sol 3 — LLM opcional como fallback:** si el parser determinista no entiende, ofrecer interpretación por LLM (vía AI Gateway). Solo opt-in, nunca en el camino crítico.

**Recomendación:** **Sol 1 + Sol 2** son una victoria clara y barata sobre Todoist (español first-class). Sol 3 es tentador pero añade latencia/coste/no-determinismo a la captura, que debe ser instantánea — **déjalo opcional y secundario**.
**Esfuerzo:** S–M (Sol 1) / S (Sol 2).
**Riesgos:** ambigüedad ("mañana" como palabra vs fecha) — ya lo manejas con preview; mantener esa salida de escape.
**Encaje:** extiende `quick-date-parse.ts` (función pura + tests, patrón ya establecido) y el chip de `CreateTaskDialog`/`GlobalQuickAdd`.

## B5. Abismo captura → organización (Inbox)

**Kino hoy:** captura buena; **el Inbox no está optimizado para procesar en masa** (tu nota + backlog UX item 4/5).

- **Sol 1 — Inbox como bandeja de procesamiento:** selección múltiple + acciones en lote (mover a sistema, fechar, etiquetar, priorizar) con atajos de teclado. "Triage mode".
- **Sol 2 — Sugerencia de destino:** Kino propone a qué sistema va cada captura (por palabras/historial); un toque para aceptar. Reduce decisiones.
- **Sol 3 — Procesamiento en cascada por teclado:** flujo tipo Superhuman: una tarea a la vez, teclas para clasificar, siguiente. Vaciar el inbox sin fricción.

**Recomendación:** **Sol 1 primero** (multi-select + bulk, reusa `bulk_move_tasks`/`bulk_update_tasks` del MCP que ya existen) y **Sol 3** como modo alternativo. Sol 2 cuando la inteligencia esté expuesta.
**Esfuerzo:** M.
**Riesgos:** bulk actions necesitan undo robusto; sin undo, un movimiento masivo erróneo asusta.
**Encaje:** los bulk endpoints ya existen en el MCP/servicio; falta la UI de selección. Patrón de teclado j/k/enter ya existe en las vistas de tareas (`useTaskKeyboardNavigation`).

## B6. Subtareas inservibles / sin jerarquía real ni dependencias

**Kino hoy:** `parentTaskId` real (subtasks + epics), `SubtaskList.tsx`. **No hay dependencias** (blocked by / blocks). Falta: ¿qué pasa al completar la madre? ¿subtarea con fecha propia?

- **Sol 1 — Pulir jerarquía existente:** subtareas con fecha/energía propias, completar madre ≠ borrar hijas, progreso de la madre = % de hijas. Mostrarlo bien en todas las vistas.
- **Sol 2 — Dependencias reales:** añadir `blocked_by`/`blocks` (tabla de aristas), bloquear que una tarea entre a "today" si su bloqueante no está done. Es lo que ni Todoist tiene bien.
- **Sol 3 — Sub-subtareas (jerarquía N niveles):** permitir profundidad arbitraria con `parentTaskId`. Cuidado: es donde Notion se vuelve abrumador.

**Recomendación:** **Sol 1 ya** (pulir lo que existe, es deuda concreta). **Sol 2 como diferenciador** pero solo en el `system_type project` (donde tiene sentido), no global. **Sol 3 NO** — limita a 1–2 niveles; profundidad infinita es la trampa de complejidad de Notion (A3).
**Esfuerzo:** M (Sol1) / M–L (Sol2).
**Riesgos:** dependencias = grafos = ciclos; validar y prevenir ciclos. Afecta a la state-machine (una tarea bloqueada no debería auto-derivar a today).
**Encaje:** `parentTaskId` ya existe; dependencias son tabla nueva + reglas en `tasks.state-machine.ts` (función pura testeable, patrón ya establecido). El board de project es el hogar natural.

## B7. Rigidez metodológica (GTD forzado)

**Kino hoy:** tu propia preocupación: Kino puede estar empujando demasiado un flujo. Mitigado por `system_type` (cada sistema su vista).

- **Sol 1 — Vistas intercambiables por sistema:** que un mismo sistema se pueda ver como lista / board / calendario según prefiera el cerebro del usuario.
- **Sol 2 — Setting de "metodología":** preset que reordena defaults (ej. "visual/kanban" vs "lista/GTD" vs "time-blocking").
- **Sol 3 — Más `system_type`:** añadir tipos para mentalidades distintas (ej. "hábitos", "PARA", "bloques de tiempo").

**Recomendación:** **Sol 1** es la respuesta más limpia y ya tienes la base (vistas existen, solo no son intercambiables). Sol 3 con cuidado (cada tipo es mantenimiento). Sol 2 puede ser solo "vista por defecto".
**Esfuerzo:** M.
**Riesgos:** N vistas × N tipos = matriz de mantenimiento; no toda vista aplica a todo dato.
**Encaje:** las vistas ya están desacopladas por `system_type`; el paso es permitir elegir vista dentro de un sistema en vez de fijarla por tipo.

## B8. Gamificación forzada / rachas tóxicas

**Kino hoy:** tablas `quests`/`inventoryItems` huérfanas (features fantasma → roadmap). Tu postura: nada de rachas, algo sano.

- **Sol 1 — Feedback de progreso, no de presión:** reflejar logro real ("completaste lo más importante de hoy") sin contadores que castigan al fallar.
- **Sol 2 — Reseñas amables periódicas:** un resumen semanal honesto (qué hiciste, dónde gastaste energía) — usa el advisor, no puntos.
- **Sol 3 — Cero gamificación:** abandonar `quests`/`inventory` definitivamente, no construir sistema de puntos.

**Recomendación:** **Sol 1 + Sol 2** (el advisor/energía *es* tu gamificación sana: insight en vez de puntos). **Sol 3 para `quests`/`inventory`** — bórralas del roadmap o decláralas muertas; arrastran deuda conceptual. Las rachas: no las hagas.
**Esfuerzo:** S–M (ligado a exponer inteligencia).
**Riesgos:** ninguno; el riesgo es construir puntos "porque sí".
**Encaje:** el recap semanal es otra superficie consumidora de `insights.service`/`energy` que ya existe.

## B9. Mala integración de calendario / falta de time-blocking

**Kino hoy:** sin calendario global; sin time-blocking. (Mismo que A9.)

- **Sol 1 — Calendario global + arrastrar tarea a una hora:** vista semana/día donde sueltas tareas en bloques. Esto sí resuelve "no sé *cuándo* haré esto".
- **Sol 2 — Time-blocking asistido por energía:** Kino sugiere a qué hora va cada tarea según tu cronotipo/curva de energía. **Nadie más tiene esto.**
- **Sol 3 — Sync calendario externo:** (= A9 Sol 2/3) feed iCal o bidi.

**Recomendación:** **Sol 1 → Sol 2.** Aquí está el diferenciador más fuerte de todo el documento: time-blocking + energía. Es la fusión de tus dos cerebros en una sola feature visible. Sol 3 después.
**Esfuerzo:** M (Sol1) / M (Sol2 sobre Sol1).
**Riesgos:** sugerencias de energía mal calibradas pierden credibilidad; empezar conservador y explicable.
**Encaje:** `energy.planner.ts`/`energy.advisor.ts` ya calculan; faltaba la superficie. La vista de calendario por sistema existe como base para la global.

## B10. Centralización / datos locales / Markdown

**Kino hoy:** datos en tu Postgres; sin export; cuadernos HTML. (Solapa con A6.)

- **Sol 1 — Export a Markdown/JSON:** (= A6 Sol 1) tu pedido directo.
- **Sol 2 — Carpeta local sincronizada (Desktop):** en la versión Desktop, espejo en disco de cuadernos .md + tareas .json. Lo que Obsidian da y Notion no.
- **Sol 3 — E2E encryption:** roadmap lejano; choca con server que procesa datos.

**Recomendación:** **Sol 1 ya, Sol 2 con Desktop.** Esto, combinado con el MCP, te da una historia de portabilidad mejor que Notion sin renunciar a la inteligencia server-side. E2E: no prometer.
**Esfuerzo:** S (Sol1) / L (Sol2).
**Riesgos:** ver A6; Sol 2 reintroduce el problema de sync de Obsidian si no se diseña con A2.
**Encaje:** Sol 1 = endpoint de export; Sol 2 = parte del proyecto Desktop, diseñar junto a offline.

---

# SECCIÓN C — OBSIDIAN

## C1. Dolor de sincronización entre dispositivos

**Kino hoy:** sync no es problema (server central). Esto es una **ventaja de Kino sobre Obsidian**, no un problema a resolver.

- **Sol 1 — Comunicarlo como ventaja:** "tus datos sincronizan solos, sin configurar iCloud ni conflictos".
- **Sol 2 — Mantenerlo así:** no migrar a local-first puro (perderías esta ventaja); offline como capa, no como modelo base (ver A2 Sol 1/3).
- **Sol 3 — Sync sin coste para el usuario:** que la sync sea parte del producto gratis (al contrario que Obsidian Sync de pago).

**Recomendación:** no es un problema; es posicionamiento. Documentar como ventaja.
**Esfuerzo:** S.
**Encaje:** N/A.

## C2. Dependencia de plugins frágiles

**Kino hoy:** sin plugins; UI no modificable (decisión tuya explícita). Ventaja: nada se rompe por un plugin abandonado.

- **Sol 1 — Mantener cero plugins de terceros:** las capacidades son nativas y curadas. Estabilidad como feature.
- **Sol 2 — "Plantillas" como única extensibilidad:** cuadernos y sistemas plantilla (no código) dan personalización sin fragilidad.
- **Sol 3 — Integraciones oficiales acotadas:** si algún día hay extensibilidad, que sea vía integraciones oficiales mantenidas (calendar, export), no un marketplace abierto.

**Recomendación:** Sol 1 + Sol 2. Es coherente con tu anti-procrastinación (C6). No abrir marketplace.
**Esfuerzo:** N/A (es postura) + el de plantillas (M, ver A3).
**Encaje:** plantillas reusan seeding de sistemas.

## C3. Cero colaboración en tiempo real

**Kino hoy:** single-user por diseño (la memoria de `project` lo confirma: multi-tenant = otro proyecto).

- **Sol 1 — Compartir read-only por link:** exportar/publicar un cuaderno como página pública (sin colaboración, solo lectura). Barato, útil.
- **Sol 2 — Colaboración asíncrona:** comentarios/menciones sin edición simultánea. Evita CRDTs.
- **Sol 3 — Edición colaborativa real:** Tiptap + Yjs (CRDT). Es L y multi-tenant; tu propia nota lo marca "muy futura".

**Recomendación:** **Sol 1 como puente** (publicar cuaderno read-only encaja con el route group `(marketing)` y con export). **Sol 3 explícitamente futuro** — no antes de resolver multi-tenant. Es un diferenciador enorme pero caro; no lo metas en la fase actual.
**Esfuerzo:** S (Sol1) / L (Sol3).
**Riesgos:** Sol 3 cambia el modelo de auth/datos por completo (de single-user a workspaces).
**Encaje:** Tiptap ya soporta Yjs si algún día; Sol 1 reusa el editor en modo read-only + ruta pública (ya proxyeas rutas públicas).

## C4. Gestión torpe de imágenes y adjuntos

**Kino hoy:** **el editor no soporta imágenes en absoluto** (sin upload, sin extensión image). Es un gap real, no solo "torpe".

- **Sol 1 — Upload a Vercel Blob + extensión image de Tiptap:** pegar/soltar imagen → sube a Blob → inserta URL en el HTML. Resize por handles. Sin ensuciar carpetas (al contrario que Obsidian).
- **Sol 2 — Base64 inline (NO):** evitar incrustar en el HTML; infla el documento y mata el rendimiento.
- **Sol 3 — Adjuntos como entidad:** tabla `attachments` ligada a página/tarea, con su propio storage y vista. Más estructura, soporta no-imágenes (PDF).

**Recomendación:** **Sol 1** es el estándar correcto y encaja con tu stack (Vercel Blob soporta público/privado). Sol 3 si luego quieres adjuntos en tareas, no solo imágenes en cuadernos. **Sol 2 jamás.**
**Esfuerzo:** M.
**Riesgos:** límites de tamaño/coste de Blob; borrar imágenes huérfanas al borrar página (limpieza). Export (A6) debe incluir las imágenes.
**Encaje:** Vercel Blob es nativo; `@tiptap/extension-image` + `transformPastedHTML`/drop handler en `EditorContext`. El HTML guardado ya admite `<img>`.

## C5. Formateo de tablas rudimentario

**Kino hoy:** **el editor no tiene tablas** (sin extensión table). Tu nota dice "las tablas no funcionan" — correcto, no existen. Tu plan de "alejarte de md" ya está hecho (es HTML).

- **Sol 1 — `@tiptap/extension-table`:** tablas WYSIWYG reales (añadir/quitar filas, redimensionar). Resuelve el dolor de Obsidian directamente, ya que no estás atado a md.
- **Sol 2 — Bloque "tabla simple" propio:** un nodo Tiptap custom más limitado pero móvil-friendly (las tablas son duras en pantalla chica).
- **Sol 3 — Tabla-base-de-datos (futuro lejano):** tablas con tipos de columna/filtros tipo Notion. Es A4 (scope creep) — cuidado.

**Recomendación:** **Sol 1** (es la solución directa y barata dado que ya usas Tiptap). Resuelve tu "futuro lejano" de tablas *ahora* sin cambiar de tecnología. **Sol 3 NO** (es justo el "aprendiz de todo"). Pensar la UX móvil de tablas (scroll horizontal contenido).
**Esfuerzo:** S–M.
**Riesgos:** tablas en móvil son incómodas; export a md de tablas anidadas; el HTML crece.
**Encaje:** extensión Tiptap sobre `EditorContext`. Cero cambio de schema.

## C6. Síndrome del sistema perfecto (procrastinación técnica)

**Kino hoy:** **Kino ya resuelve esto por diseño** (sistemas predefinidos, sin CSS/plugins). Es tu tesis central. Solo hay que protegerla.

- **Sol 1 — Defaults que funcionan sin tocar nada:** cada sistema usable al crearse, sin configuración previa (= plantillas, A3).
- **Sol 2 — Limitar la "configurabilidad":** no añadir ajustes cosméticos; lo único editable: carpetas y (futuro) plantillas. Mantén la restricción.
- **Sol 3 — Empujar a la acción, no al setup:** el onboarding termina con el usuario *creando algo real*, no configurando.

**Recomendación:** las tres son tu visión; el trabajo es **resistir** añadir personalización. Documentar como no-objetivo (A4 Sol 1).
**Esfuerzo:** N/A (disciplina) / M (plantillas).
**Encaje:** refuerza A3 y C2.

## C7. Grafo visual que pierde utilidad

**Kino hoy:** no existe nada de grafo. Tu nota: te gustaría explorarlo *útilmente*.

- **Sol 1 — No hacer grafo "bonito":** evitar la bola de puntos inútil de Obsidian. Si hay grafo, que sea funcional.
- **Sol 2 — Vínculos contextuales en vez de grafo:** "tareas vinculadas a esta página" (ya tienes `LinkedTasksPanel`/`link_task_to_page`), backlinks entre cuadernos. Utilidad sin grafo gigante.
- **Sol 3 — Grafo acotado por sistema:** si quieres lo visual, un mini-grafo por sistema (no global), que a esa escala sí es legible.

**Recomendación:** **Sol 2** es el camino correcto: el valor de los links es la navegación, no el dibujo. **Ya tienes la base** (tasks↔pages). Añade backlinks página↔página. Sol 3 solo como exploración visual futura, nunca como gancho principal.
**Esfuerzo:** S (backlinks) / M (mini-grafo).
**Riesgos:** el grafo global no escala (la propia crítica de Obsidian) — no caer en eso.
**Encaje:** `link_task_to_page` y `LinkedTasksPanel` ya existen; backlinks página↔página son una extensión natural (tabla de links + UI de menciones).

---

# SECCIÓN D — FEATURES NUEVOS (consolidado)

Ordenados por (impacto × encaje con tu visión ÷ esfuerzo).

1. **Calendario global + time-blocking asistido por energía** (A9/B9) — *el* diferenciador. Fusiona tus dos cerebros visualmente. **M**.
2. **Exposición de la inteligencia en una sola superficie** ("Hoy/Coach") (A7/B8) — desbloquea valor ya construido. **M**.
3. **Exportar a Markdown/JSON** (A6/B10) — pedido directo, portabilidad honesta, barato. **S–M**.
4. **Imágenes en cuadernos (Vercel Blob)** (C4) — gap real, esperado por cualquiera. **M**.
5. **Tablas en cuadernos (Tiptap table)** (C5) — resuelve tu "futuro lejano" hoy. **S–M**.
6. **Inbox de triage (multi-select + bulk + atajos)** (B5) — cierra el abismo captura→organización. **M**.
7. **Replanificación amable de vencidas** (B2) — anti-estrés, tu promesa central. **M**.
8. **Búsqueda global indexada** (A5) — necesaria a escala, muy pedida. **M**.
9. **Captura offline (cola de mutaciones)** (A2 Sol 3) — "nunca pierdo un pensamiento". **S–M**.
10. **Dependencias de tareas en `project`** (B6 Sol 2) — lo que ni Todoist hace bien. **M–L**.
11. **Backlinks página↔página** (C7) — utilidad de grafo sin el grafo. **S**.
12. **Publicar cuaderno read-only por link** (C3 Sol 1) — puente a colaboración. **S**.
13. **Plantillas de sistema y de cuaderno** (A3/C6) — anti-parálisis. **M**.
14. **Slash menu + paste limpio en el editor** (A8) — escribir se siente bien. **M**.

---

# SECCIÓN E — FEATURES A MEJORAR (actuales)

1. **Subtareas/epics** (B6 Sol 1): fecha/energía propias, completar madre sin borrar hijas, % de progreso, mostrarse bien en todas las vistas.
2. **Recurrencia** (a medias, sin UI): terminarla o marcarla futuro explícito; hoy es deuda colgando. Ver PLAN-06.
3. **Editor Tiptap** (A8): falta slash menu, atajos, paste robusto; base buena, infrautilizada.
4. **Captura rápida / NL parser** (B4): extender a prioridad/sistema/etiqueta/duración (no solo fechas).
5. **Vistas por sistema** (B7): hacerlas intercambiables dentro de un sistema, no fijas por tipo.
6. **Optimistic UI** (A1): generalizarlo para que toda mutación se sienta instantánea.
7. **`insights.service`/advisor** (A7): conectarlo a una superficie de UI (hoy: 0 consumidores `.tsx`).
8. **Command palette** (A5): de "lista de sistemas" a búsqueda global real.
9. **Tablas huérfanas `quests`/`inventoryItems`** (B8): decisión definitiva — matar o roadmap, no dejar en limbo.

---

# SECCIÓN F — RUMBO RECOMENDADO

**Principio rector:** Kino gana exponiendo su inteligencia con fricción cero, no acumulando features. Cada cosa nueva debe servir a *capturar sin esfuerzo* o *saber qué hacer y cuándo* — sin abrumar.

**Orden sugerido (de mayor ROI a menor):**

1. **Editor "completo de verdad":** imágenes (C4) + tablas (C5) + slash/paste (A8). Cierra los gaps más obvios y visibles del cuaderno. *Estos tres juntos = una sesión-proyecto bien delimitada.*
2. **Inteligencia visible en una superficie** (A7/B8) + **export** (A6). Convierte trabajo ya hecho en valor + portabilidad honesta.
3. **Calendario global → time-blocking con energía** (A9/B9). El diferenciador grande; requiere base nueva.
4. **Inbox de triage + replanificación amable** (B5/B2). El eje anti-estrés y de organización masiva.
5. **Captura offline** (A2 Sol 3) como primer paso de la historia offline; **búsqueda global** (A5) cuando crezcan los datos.
6. **Diferenciadores caros (futuro):** dependencias (B6), colaboración (C3), Desktop+local files+sync (B3/B10), E2E (no prometer).

**No hacer (anti-objetivos, A4):** tablas-base-de-datos tipo Notion, jerarquía infinita de subtareas, marketplace de plugins, rachas/puntos, sync bidireccional de calendario antes de tener la vista, E2E mientras el server procese datos.

**Decisiones que requieren tu OK antes de cualquier PLAN:**
- ¿`quests`/`inventoryItems` se matan o siguen en roadmap?
- ¿Offline = "captura" (barato) o "lectura+cola" (medio) como meta de fase?
- ¿Dependencias solo en `project` o global?
- ¿Publicar cuaderno read-only entra antes que colaboración, o se deja todo para multi-tenant?
