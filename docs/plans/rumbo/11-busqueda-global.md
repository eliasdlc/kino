# PLAN 11 — Búsqueda global indexada (command palette → búsqueda real)

> Origen: Sección E item 8 (A5). Esfuerzo M. ROI ★★ (sube con el volumen de datos).
> Idea central: el command palette hoy es "lista de sistemas + navegación". Convertirlo en
> **búsqueda global real** sobre tareas y páginas, indexada en server (Postgres full-text).

## Estado hoy

- `src/features/command-palette/GlobalCommandPalette.tsx`: `cmdk`, con acciones fijas
  (nueva tarea), navegación (inbox/dashboard/sistemas/tareas) y lista de sistemas. **No busca contenido.**
- Filtrado actual es en cliente sobre los items fijos (lo que `cmdk` filtra), no sobre datos reales.
- Postgres (Neon) tiene full-text nativo (`tsvector`). Drizzle no tiene helper directo; se usa `sql`.
- No hay endpoint de búsqueda.

## Estrategia
Empezar simple (búsqueda server por `ILIKE` sobre título) y, si el volumen lo pide, subir a
`tsvector`. La home natural de la búsqueda es el command palette que ya existe.

---

## Sprint 1 — Endpoint de búsqueda (MVP `ILIKE`)

### Ticket 1.1 — Servicio de búsqueda
**Estado hoy:** no existe.
**Pasos:**
1. Crear `src/features/search/search.service.ts` con `searchAll(userId, q, limit)` que consulta:
   - tareas: `title ILIKE %q%` (y opcional `description`), `deletedAt IS NULL`.
   - páginas: `title ILIKE %q%`, `deletedAt IS NULL`.
2. Devolver resultados tipados con `{ type: 'task'|'page', id, title, systemId? }`.
**Hecho cuando:** una función devuelve tareas y páginas que matchean un término.

### Ticket 1.2 — Endpoint + hook
**Pasos:**
1. `GET /api/search?q=` en una ruta nueva.
2. Hook `useSearch(q)` con `enabled: q.length >= 2` y `debounce`/`keepPreviousData`.
**Hecho cuando:** el cliente obtiene resultados de búsqueda en vivo.

---

## Sprint 2 — Integrar al command palette

### Ticket 2.1 — Modo búsqueda en el palette
**Estado hoy:** `cmdk` filtra solo items locales.
**Pasos:**
1. Conectar el `CommandInput` a `useSearch(query)`.
2. Añadir grupos "Tareas" y "Páginas" con los resultados remotos (desactivar el filtro local de `cmdk` para esos grupos con `shouldFilter={false}` cuando hay query).
3. Mantener las acciones/navegación cuando el query está vacío.
**Hecho cuando:** escribir en ⌘K busca tareas y páginas reales y navega al seleccionar.

### Ticket 2.2 — Navegar al resultado
**Pasos:**
1. Seleccionar una tarea → abrir su `TaskDetailSheet` o ir a su sistema con foco; una página → abrir el cuaderno.
**Hecho cuando:** elegir un resultado lleva al ítem correcto.

---

## Sprint 3 — Full-text indexado (si el volumen lo pide)

### Ticket 3.1 — Columna `tsvector` + índice GIN
**Estado hoy:** búsqueda por `ILIKE` (suficiente a baja escala, lenta a gran escala).
**Pasos:**
1. Migración (drizzle `db:generate`): añadir columna generada `search_vector tsvector` a `tasks` y `pages` (o índice de expresión) + índice GIN.
2. Cambiar `searchAll` a `to_tsquery`/`websearch_to_tsquery` con ranking.
**Hecho cuando:** la búsqueda usa el índice fts y rankea por relevancia.

### Ticket 3.2 — Mantener el índice sincronizado
**Pasos:**
1. Si es columna generada (`GENERATED ALWAYS AS`), no requiere trigger; si no, añadir trigger.
2. Verificar que crear/editar mantiene el vector.
**Hecho cuando:** editar un título actualiza el resultado de búsqueda sin pasos manuales.

## Nota de secuencia
Si hoy tienes pocos datos, el Sprint 3 es prematuro: queda como upgrade cuando se note lentitud (A5 Sol3).
