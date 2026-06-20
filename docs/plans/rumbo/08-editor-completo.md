# PLAN 08 — Editor completo (tablas + imágenes + slash/paste)

> Origen: Sección E item 3 (A8) + C4 (imágenes) + C5 (tablas) + Sección F item 1.
> Esfuerzo M. ROI ★★★. F lo recomienda como **primera victoria visible** por ser autocontenido.
> Todo es configuración de extensiones Tiptap sobre `EditorContext.tsx`. Cero cambio de schema
> (el HTML guardado ya admite `<img>` y `<table>`).

## Estado hoy

- `src/features/pages/EditorContext.tsx`: Tiptap con `StarterKit`, `Typography`, `Placeholder`,
  `StickyAnchorMark`. **Sin tablas, sin imágenes, sin slash menu, sin paste handler.**
- Se guarda como **HTML** (`editor.getHTML()`), autosave debounce ~1.5s.
- Deps: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`, extensiones placeholder/typography.
- `@tiptap/extension-table` e `@tiptap/extension-image` **no están instalados**.
- Vercel Blob es nativo del stack (soporta público/privado) para subir imágenes.

## Estrategia
Por ROI dentro del plan: **tablas** (S–M, resuelve dolor de Obsidian directo) → **slash/paste**
(corazón de "escribir se siente bien") → **imágenes** (M, requiere Blob). Lazy-load de extensiones
pesadas para no inflar el bundle del editor.

---

## Sprint 1 — Tablas

### Ticket 1.1 — Instalar y registrar la extensión table
**Pasos:**
1. `pnpm add @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header`.
2. Registrarlas en `EditorContext.tsx` (`Table.configure({ resizable: true })` + row/cell/header).
**Hecho cuando:** se puede crear una tabla y persiste en el HTML al recargar.

### Ticket 1.2 — Controles de tabla
**Pasos:**
1. UI mínima para insertar tabla y añadir/quitar fila/columna (toolbar contextual o desde el slash menu del Sprint 2).
**Hecho cuando:** se puede construir y editar una tabla sin tocar HTML.

### Ticket 1.3 — UX móvil de tablas
**Pasos:**
1. Contenedor con scroll horizontal para que la tabla no rompa el layout en pantalla chica (ver `project-mobile`).
**Hecho cuando:** en móvil la tabla scrollea horizontal sin desbordar.

---

## Sprint 2 — Slash menu + paste robusto + atajos

### Ticket 2.1 — Slash command menu (`/`)
**Estado hoy:** no hay menú de inserción.
**Pasos:**
1. Añadir `@tiptap/suggestion` (o la utilidad de suggestion de Tiptap) para disparar un menú al escribir `/`.
2. Items: heading 1/2/3, lista, lista de tareas, cita, bloque de código, tabla (Sprint 1), imagen (Sprint 3).
3. Componente flotante `SlashMenu.tsx` navegable por teclado.
**Hecho cuando:** escribir `/` muestra el menú y cada item inserta su bloque.

### Ticket 2.2 — Paste handler robusto
**Estado hoy:** el paste usa el comportamiento por defecto.
**Pasos:**
1. Configurar `editorProps.transformPastedHTML` para sanitizar/normalizar HTML pegado de la web (quitar estilos inline ruidosos, normalizar headings/listas).
2. Pegar texto plano con Shift no debe romper.
**Hecho cuando:** pegar de una web mantiene estructura sin basura de estilos.

### Ticket 2.3 — Atajos de bloque (Markdown shortcuts)
**Pasos:**
1. Verificar/activar input rules de StarterKit/Typography (`#`, `-`, `>`, ``` ``` ```).
2. Documentar los atajos disponibles.
**Hecho cuando:** `# ` crea heading, `- ` lista, etc., al escribir.

---

## Sprint 3 — Imágenes (Vercel Blob)

### Ticket 3.1 — Endpoint de subida a Blob
**Estado hoy:** no hay upload.
**Pasos:**
1. Endpoint `POST /api/upload` que sube a Vercel Blob y devuelve la URL (usar `@vercel/blob`).
2. Validar tipo/tamaño.
**Hecho cuando:** un POST con una imagen devuelve una URL servible.

### Ticket 3.2 — Extensión image + drop/paste
**Pasos:**
1. `pnpm add @tiptap/extension-image`; registrarla.
2. Handler de drop/paste de imágenes: subir a `/api/upload` y insertar `<img src=url>`. **Nunca base64 inline** (C4 Sol2 prohibido).
3. Resize por handles.
**Hecho cuando:** arrastrar/pegar una imagen la sube y la inserta, y persiste.

### Ticket 3.3 — Limpieza de imágenes huérfanas
**Pasos:**
1. Al borrar una página, borrar sus blobs asociados (o marcar para limpieza diferida).
**Hecho cuando:** borrar un cuaderno no deja imágenes huérfanas en Blob.

---

## Sprint 4 — Rendimiento

### Ticket 4.1 — Lazy-load de extensiones pesadas
**Pasos:**
1. Cargar table/image con `next/dynamic` o import diferido para no inflar el bundle inicial del editor.
**Hecho cuando:** el editor base no crece de peso de forma notable.

## Anti-objetivo
- Tabla-base-de-datos tipo Notion (tipos de columna/filtros): **NO** (C5 Sol3, scope creep A4).

## Dependencia inversa
- El Plan 06 (export) debe actualizarse cuando existan tablas/imágenes (qué se preserva en md/ZIP).
