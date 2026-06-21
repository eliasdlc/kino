# PLAN 06 — Export a Markdown / JSON

> Origen: Sección A6 / B10 + Sección F item 2. Esfuerzo S–M. ROI ★★★★.
> Pedido directo y diferenciador honesto de portabilidad. Empezar por **una entidad**
> (cuaderno), luego export masivo del workspace.

## Estado hoy

- **Sin exportación** de ningún tipo.
- Cuadernos se guardan como **HTML** (`pages.content` text; el editor usa `editor.getHTML()`).
- `turndown` **no está instalado** (habría que añadirlo para HTML→Markdown).
- Datos viven en Postgres (Neon); el MCP (~50 tools) ya es, de facto, una salida de datos.
- Vercel Functions soportan streaming (para el ZIP del export masivo).

## Estrategia
Fase 1: exportar **un cuaderno** a Markdown y a JSON (descarga directa, cliente).
Fase 2: exportar **un sistema/tarea** a JSON.
Fase 3: export masivo del workspace (ZIP con carpetas).

---

## Sprint 1 — Exportar un cuaderno

### Ticket 1.1 — Añadir `turndown`
**Estado hoy:** no está en deps.
**Pasos:**
1. `pnpm add turndown` (+ `@types/turndown` en dev).
2. Crear `src/features/pages/export/html-to-markdown.ts` con una función pura `htmlToMarkdown(html)`.
3. Configurar turndown para el HTML que produce Tiptap (headings, listas, código, blockquote, typography).
**Hecho cuando:** una función convierte el HTML de una página a Markdown limpio.

### Ticket 1.2 — Decidir qué se preserva y qué se pierde
**Estado hoy:** el HTML tiene `StickyAnchorMark` (marcas de sticky) que no tienen equivalente md.
**Pasos:**
1. Documentar en un comentario qué se conserva (texto, headings, listas, código, citas) y qué se descarta (anclas de sticky; futuras tablas/imágenes cuando lleguen del Plan 08).
2. Para anclas de sticky: quitar la marca dejando el texto plano.
**Hecho cuando:** la conversión no rompe ni deja basura por marcas custom.

### Ticket 1.3 — Botón "Exportar" en el cuaderno
**Estado hoy:** `NotebookEditorLayout.tsx` / `NotebookEditor.tsx` no tienen export.
**Pasos:**
1. Añadir un menú "Exportar" con "Markdown (.md)" y "JSON (.json)".
2. Markdown: `htmlToMarkdown(content)` → `Blob` → descarga (`download` attr / `URL.createObjectURL`).
3. JSON: `{ title, content, createdAt, updatedAt, tags }` → descarga.
4. Nombre de archivo: slug del título.
**Hecho cuando:** desde un cuaderno bajo un `.md` legible y un `.json` con sus campos.

---

## Sprint 2 — Exportar tarea y sistema (JSON)

### Ticket 2.1 — Export de una tarea a JSON
**Pasos:**
1. Acción en `TaskDetailSheet.tsx`: "Exportar JSON" con los campos relevantes (incluye subtareas vía `getSubtasks`).
**Hecho cuando:** una tarea (con sus hijas) se baja como JSON.

### Ticket 2.2 — Export de un sistema a JSON
**Pasos:**
1. Endpoint `GET /api/systems/[id]/export` que arma `{ system, tasks, folders, pages }`.
2. Botón en el toolbar del sistema.
**Hecho cuando:** un sistema entero se baja como un JSON estructurado.

---

## Sprint 3 — Export masivo del workspace (ZIP)

### Ticket 3.1 — Endpoint de export total (streaming)
**Estado hoy:** nada.
**Pasos:**
1. Añadir lib de zip en server (p. ej. `archiver` o equivalente compatible con streaming en Vercel Functions).
2. Endpoint `GET /api/export/workspace` que recorre sistemas → carpetas → cuadernos (.md) + tareas (.json) y stremea un ZIP con estructura de carpetas tipo "export de Notion" pero limpio.
**Hecho cuando:** se descarga un ZIP navegable con todo el workspace.

### Ticket 3.2 — Incluir imágenes (cuando exista Plan 08)
**Pasos:**
1. Marcar como dependencia de Plan 08: si hay imágenes en Blob, incluirlas en el ZIP y reescribir las URLs a rutas relativas.
**Hecho cuando:** (futuro) el ZIP es autocontenido con sus imágenes.

## Anti-objetivo
- E2E encryption: **no prometer** — el server procesa datos (energía, crons). Fuera de alcance.

## Marketing gratis (A6 Sol3)
- El MCP ya es portabilidad ("tus datos son consultables por agentes/tú"). Comunicarlo, no construir nada.
