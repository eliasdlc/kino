# RUMBO — Índice y lista priorizada (Secciones E + F)

> Versión: 2026-06-19
> Origen: `docs/plans/ANALISIS-competidores-y-rumbo.md`, secciones **E (mejorar lo actual)** y **F (rumbo)**.
> Meta: consolidar y pulir lo que Kino ya tiene antes de agregar features grandes.
> Estado de cada plan: **borrador para ejecutar** — cada archivo es un roadmap independiente con sprints → tickets.

---

## Cómo leer estos planes

- Cada archivo `NN-*.md` = **un plan** (un roadmap autónomo).
- Cada plan tiene **Sprints** (bloques de trabajo) y dentro **Tickets**.
- Cada **ticket** tiene:
  - **Estado hoy** — qué hay de verdad en el código.
  - **Pasos** — pasos pequeños y visibles (el próximo paso fácil, no el paso 10).
  - **Hecho cuando** — criterio de cierre verificable.
- Los tickets son intencionalmente cortos. Un ticket = algo que terminas y ves funcionar.

## Orden de prioridad — (impacto × encaje con tu visión ÷ esfuerzo)

El número es el orden recomendado de ataque. La columna **ROI** es la heurística
(↑ = más alto). Donde el orden por ROI choca con una dependencia técnica, la nota lo dice.

| # | Plan | Origen E/F | Esfuerzo | ROI | Por qué aquí |
|---|---|---|---|---|---|
| 01 | [NL parser extendido](01-nl-parser.md) | E4 / B4 | S–M | ★★★★★ | Casi gratis, español first-class, base ya existe (`quick-date-parse.ts`). |
| 02 | [Inteligencia visible](02-inteligencia-visible.md) | E7 / A7,B8 / F2 | M | ★★★★★ | Valor ya construido pero invisible (`insights.service` con 0 consumidores `.tsx`). |
| 03 | [Inbox triage + replanificación amable](03-inbox-triage.md) | B5,B2 / F4 | M | ★★★★ | Eje anti-estrés (tu promesa central). Reusa bulk endpoints existentes. |
| 04 | [Calendario global + time-blocking](04-calendario-timeblocking.md) | A9,B9 / F3 | M–L | ★★★★ | *El* diferenciador. Fusiona los dos cerebros. Requiere base nueva. |
| 05 | [Optimistic UI generalizado](05-optimistic-ui.md) | E6 / A1 | S–M | ★★★★ | Patrón ya existe en `tasks.hooks.ts`; falta generalizarlo. Gran impacto percibido. |
| 06 | [Export Markdown/JSON](06-export.md) | E (A6,B10) / F2 | S–M | ★★★★ | Pedido directo, portabilidad honesta, barato. |
| 07 | [Captura offline](07-offline-captura.md) | A2 / F5 | S–M | ★★★ | "Nunca pierdo un pensamiento". Vive sobre TanStack, sin tocar schema. |
| 08 | [Editor completo (tablas + imágenes + slash/paste)](08-editor-completo.md) | E3 / C4,C5,A8 / F1 | M | ★★★ | Gaps visibles del cuaderno. Todo es config de Tiptap. |
| 09 | [Subtareas / epics pulidas](09-subtareas-epics.md) | E1 / B6 Sol1 | M | ★★★ | Deuda concreta: jerarquía existe a nivel datos, mal expuesta. |
| 10 | [Vistas intercambiables por sistema](10-vistas-intercambiables.md) | E5 / B7 | M | ★★ | Anti-rigidez metodológica. Las vistas ya están desacopladas por tipo. |
| 11 | [Búsqueda global indexada](11-busqueda-global.md) | E8 / A5 / F5 | M | ★★ | Command palette → búsqueda real. Necesaria a escala. |
| 12 | [Recurrencia: terminar o enterrar](12-recurrencia.md) | E2 | S–M | ★★ | Deuda colgando. Decisión + ejecución. |
| 13 | [Limpieza de features fantasma](13-limpieza-fantasma.md) | E9 / B8 | S | ★★★ | `quests`/`inventoryItems` → **matar** (ya decidido). Barato, quita deuda conceptual. |
| 14 | [Diferenciadores caros (futuro)](14-diferenciadores-caros.md) | F6 / B6 Sol2,C3,B3,B10 | L | ★ | Dependencias, colaboración read-only, Desktop+local+sync. Roadmap, no detalle fino. |

### Notas de secuencia (dependencias reales)

- **05 (Optimistic UI) y 13 (limpieza)** son baratos y sin dependencias: se pueden
  intercalar como "relleno" entre planes grandes.
- **04 (Calendario)** es prerequisito de cualquier integración de calendario externa
  (iCal/Google) y del time-blocking — no se puede saltar.
- **11 (Búsqueda)** rinde más cuando hay volumen de datos; si hoy tienes pocos, baja su urgencia real aunque el ROI teórico sea medio.
- **F recomienda** arrancar por el **editor (08)** por ser "una sesión-proyecto bien
  delimitada y muy visible". Por ROI puro va más abajo. Si quieres una victoria
  visible y autocontenida primero, sube el 08; si quieres exponer valor ya construido,
  arranca por 01→02.

## Anti-objetivos (recordatorio, Sección A4/F)

No hacer dentro de este rumbo: tablas-base-de-datos tipo Notion, jerarquía infinita de
subtareas, marketplace de plugins, rachas/puntos, sync bidireccional de calendario
antes de tener la vista, E2E mientras el server procese datos.
