# PLAN 01 — Captura rápida / NL parser extendido

> Origen: Sección E item 4 (B4). Esfuerzo S–M. ROI ★★★★★.
> Idea central: extender el parser determinista de español para que entienda **prioridad,
> sistema, etiqueta y duración**, no solo fechas. Mantener el chip de preview editable.

## Estado hoy

- `src/features/tasks/quick-date-parse.ts`: función pura `parseQuickDate(input, now)` que
  detecta **fechas/horas** en español ("mañana", "lunes", "a las 5", "5pm"), las quita del
  título y devuelve `{ title, dueDate, dueTime }`. Tiene tests en `quick-date-parse.test.ts`.
- Se consume desde `GlobalQuickAddDialog.tsx` y `CreateTaskDialog.tsx` (captura rápida).
- `classifyTask` (en `insights.service.ts`) ya hace un match básico de sistema y prioridad
  por keywords, pero es server-side y no se usa en la captura en vivo.
- **No existe** parsing de prioridad/sistema/tag/duración en el camino de captura del cliente.

## Principio rector

El parser es **puro y determinista** (sin LLM en el camino crítico). Siempre se muestra un
**preview editable** con opción de ignorar lo detectado (ya es el patrón actual). El LLM
queda fuera de este plan (sería opt-in y secundario, Sección B4 Sol3).

---

## Sprint 1 — Reestructurar el parser para múltiples campos

### Ticket 1.1 — Renombrar el resultado a un tipo extensible
**Estado hoy:** `ParsedQuickDate` solo tiene campos de fecha.
**Pasos:**
1. En `quick-date-parse.ts`, crear un tipo nuevo `ParsedQuickInput` con los campos
   actuales (`title`, `dueDate?`, `dueTime?`) más placeholders opcionales:
   `priority?`, `systemHint?`, `tagHint?`, `estimatedMinutes?`.
2. Hacer que `parseQuickDate` siga devolviendo solo lo de fecha (no romper consumidores).
3. No tocar la UI todavía.
**Hecho cuando:** compila (`pnpm typecheck`) y los tests de fecha siguen verdes (`pnpm test quick-date-parse`).

### Ticket 1.2 — Crear `parseQuickInput` como orquestador
**Estado hoy:** todo vive en una sola función de fecha.
**Pasos:**
1. Añadir `export function parseQuickInput(input, now): ParsedQuickInput`.
2. Que internamente llame a `parseQuickDate` y luego a sub-parsers (tickets siguientes),
   cada uno quitando su token del `title` y devolviendo el `rest`.
3. Orden de strip: fecha → hora → prioridad → sistema → tag → duración → trim final del título.
**Hecho cuando:** `parseQuickInput("comprar pan mañana")` devuelve lo mismo que antes para fecha y `title` limpio.

---

## Sprint 2 — Sub-parsers por campo (uno por ticket, con test)

> Cada sub-parser es una función pura pequeña + un caso de test. Patrón ya establecido.

### Ticket 2.1 — Prioridad (`!1..!4`, "urgente")
**Pasos:**
1. Regex para tokens `!1|!2|!3|!4` y palabras (`urgente`, `importante`, `algún día`).
   Reutilizar el vocabulario de `PRIORITY_KEYWORDS` de `insights.service.ts` (copiar el
   mapa a `quick-date-parse.ts` o extraerlo a un util compartido si se usa en 2+ sitios).
2. Mapear a `priority: 'critical'|'high'|'medium'|'low'`.
3. Quitar el token del título.
4. Test: `"pagar luz !1"` → `priority: 'critical'`, `title: "pagar luz"`.
**Hecho cuando:** test verde, título sin el token.

### Ticket 2.2 — Sistema (`#nombre`)
**Pasos:**
1. Regex `#(\w+)` → `systemHint: 'nombre'` (string, no id: la resolución a id se hace en UI
   con la lista de `useSystems()`).
2. Quitar token del título.
3. Test: `"leer paper #estudio"` → `systemHint: "estudio"`.
**Hecho cuando:** test verde.

### Ticket 2.3 — Etiqueta de contexto (`@tag`)
**Pasos:**
1. Regex `@(\w+)` → `tagHint`.
2. Quitar token. Test: `"llamar banco @casa"` → `tagHint: "casa"`.
**Hecho cuando:** test verde.

### Ticket 2.4 — Duración estimada (`30min`, `1h`, `1h30`)
**Pasos:**
1. Regex para `(\d+)\s*(min|m|h)` y combinaciones `1h30`. Devolver `estimatedMinutes`.
2. Quitar token. Test: `"deep work 1h30"` → `estimatedMinutes: 90`.
3. Ojo: la columna es `estimatedTime` tipo `time` (HH:MM:SS) — convertir minutos a `HH:MM` al guardar (eso es trabajo de la UI/hook, no del parser).
**Hecho cuando:** test verde con los 3 formatos.

---

## Sprint 3 — Conectar a la captura (preview editable)

### Ticket 3.1 — Cambiar el consumidor al nuevo parser
**Estado hoy:** `GlobalQuickAddDialog.tsx` llama a `parseQuickDate`.
**Pasos:**
1. Cambiar a `parseQuickInput`.
2. Resolver `systemHint` → id buscando en `useSystems()` por nombre (case/acentos-insensible, reutilizar `normalize` de `insights.service` o el `stripAccents` del parser).
3. Resolver `tagHint` → context tag por nombre (hook de tags existente en `src/features/tags`).
**Hecho cuando:** escribir `"informe #trabajo !2 mañana 1h"` precarga sistema, prioridad, fecha y duración en el form.

### Ticket 3.2 — Extender el chip de preview a los nuevos campos
**Estado hoy:** el chip muestra solo la fecha detectada con opción de ignorar.
**Pasos:**
1. Añadir chips para prioridad/sistema/tag/duración, cada uno con su "x" para ignorar
   (mismo patrón visual que el chip de fecha actual).
2. Si un `systemHint`/`tagHint` no resuelve a nada, mostrar el chip en estado neutro
   (texto plano) sin forzar nada.
**Hecho cuando:** cada campo detectado tiene su chip y se puede descartar individualmente sin perder los demás.

### Ticket 3.3 — Replicar en `CreateTaskDialog`
**Pasos:**
1. Mismo cambio de parser + chips en `CreateTaskDialog.tsx` si comparte el input de captura.
2. Si la lógica de chips se repite, extraerla a un componente `QuickParsePreview` en `src/features/tasks/`.
**Hecho cuando:** ambos diálogos se comportan igual.

---

## Riesgos
- Ambigüedad ("mañana" palabra vs fecha) — ya resuelto con preview; no romper esa salida.
- `#`/`@` podrían chocar con texto legítimo — exigir límite de palabra y permitir ignorar vía chip.
