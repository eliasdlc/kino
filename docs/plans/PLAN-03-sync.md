# PLAN-03 — Sync: import unidireccional de calendarios externos

> Prioridad: 6 (último — requiere decisión de diseño)
> Rama: `feat/plan-03-sync-import`
> Depende de: ninguno técnicamente, pero conviene tener PLAN-06 Capa 1 antes (las tareas importadas pueden ser recurrentes)
> Desbloquea: nada

---

## 1. Contexto y diagnóstico

### Lo que existe hoy

`src/features/sync/` está **vacío**. No hay código. Lo que existe en AGENTS.md como "sync adapters Premium" es arquitectura planeada, no construida.

El schema sí tiene:
- `tasks.external_source` (varchar 255) — para marcar el origen externo de una tarea importada.
- No hay tabla de conexiones OAuth, no hay tabla de sync state.

### El feedback y su alcance real

El feedback pregunta "¿funciona bidireccional? ¿Si marcan done en Calendar se actualiza en Kino?". La respuesta honesta es: **no existe ni unidireccional**.

Bidireccional verdadero (marcar done en Calendar → Kino se actualiza) requiere:
- Webhooks de Google Calendar (push notifications) que expiran cada ~7 días y hay que renovar.
- Mapeo de estados: Calendar no tiene concepto de "done" en un evento — requiere heurística (evento pasado = done?).
- Servidor persistente o cron muy frecuente para polling.
- Complejidad de conflictos (qué pasa si se edita en ambos lados).

Todo esto choca con los constraints de la arquitectura:
- **100% Serverless** — no hay servidor persistente.
- **Vercel 10s limit** — no se puede hacer sync pesado en una request.
- **$0/mes** — webhooks de Calendar requieren infraestructura de renovación.
- **Sin Redis/queue** — no hay cola de trabajos para procesar eventos.

**Alcance de este plan: import unidireccional .ics**. El usuario provee una URL de calendario (.ics) y Kino importa los eventos como tareas. Esto:
- Es compatible con Google Calendar, iCloud, Outlook (todos exportan .ics).
- No requiere OAuth.
- Es pull (Kino lo inicia), no push (Calendar no notifica a Kino).
- El cron existente puede re-importar periódicamente (lazy evaluation).
- **No es bidireccional** — se documenta explícitamente en la UI.

La decisión de implementar bidireccional real queda fuera de este plan y requiere una conversación de diseño separada sobre constraints vs. valor.

---

## 2. Objetivo y criterios de aceptación

- [ ] El usuario puede conectar un calendario vía URL .ics (campo en Settings o en onboarding premium).
- [ ] Kino parsea el .ics y crea tareas en el sistema designado por el usuario (por defecto Inbox).
- [ ] Cada tarea importada tiene `external_source` con la URL del calendario y el UID del evento iCalendar.
- [ ] Los eventos duplicados (mismo UID) se actualizan, no se crean de nuevo.
- [ ] Solo se importan eventos con `SUMMARY` y `DTSTART` (mínimo RFC 5545).
- [ ] La importación respeta el límite de 10s: máximo 30 días hacia adelante por request.
- [ ] El cron diario puede re-importar calendarios activos (lazy evaluation).
- [ ] La UI indica claramente que el sync es de **lectura únicamente** (Kino lee el calendario; cambios en Kino no se reflejan en el calendario externo).
- [ ] `pnpm typecheck && pnpm lint && pnpm build && pnpm test` pasan.

---

## 3. Decisiones de diseño

### Schema nuevo: tabla `calendar_connections`

```sql
CREATE TABLE calendar_connections (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  system_id   UUID REFERENCES systems(id) ON DELETE SET NULL,  -- sistema destino de las tareas
  name        VARCHAR(255) NOT NULL,                           -- nombre que el usuario le da
  ics_url     TEXT NOT NULL,                                   -- URL .ics (puede ser privada)
  last_synced_at TIMESTAMPTZ,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Alternativa sin schema nuevo**: guardar la URL en `user_preferences` o similar. **Descartada** — varias conexiones por usuario requieren tabla propia.

### Parsing de .ics

Dependencia: `ical.js` (listada en AGENTS.md, no instalada aún).

```bash
pnpm add ical.js
pnpm add -D @types/ical.js  # si existe
```

Parser: `ICAL.parse(icsString)` → componente raíz → iterar `VEVENT`s.

Por cada VEVENT:
1. Extraer `SUMMARY` (título), `DTSTART` (fecha inicio), `DTEND` (fecha fin, opcional), `UID` (identificador único), `DESCRIPTION` (descripción, opcional), `RRULE` (si el evento es recurrente).
2. Convertir `DTSTART` a UTC (`ICAL.Time.fromJSDate(date, true).toJSDate()`).
3. Filtrar: solo eventos desde `now` hasta `now + 30 días`.
4. Crear/actualizar tarea con `external_source = "${icsUrl}::${uid}"`.

### Upsert de tareas importadas

`external_source` actúa como clave de deduplicación:
```sql
INSERT INTO tasks (external_source, title, ...)
ON CONFLICT DO NOTHING  -- si ya existe con ese external_source, no hacer nada
-- O actualizar si el título cambió:
ON CONFLICT (external_source) DO UPDATE SET title = EXCLUDED.title, due_date = EXCLUDED.due_date
```

Drizzle soporta `onConflictDoUpdate` con índice único. Requiere añadir `uniqueIndex` sobre `external_source` **parcial** (solo cuando no es null).

**Cuidado con el límite de 10s**: si el .ics tiene cientos de eventos, el INSERT en loop puede exceder el timeout. Solución: procesar en batch (insertar de 20 en 20) y limitar el rango de fechas.

### Autenticación de la URL .ics

Si la URL .ics es privada (Google Calendar privado), la URL ya incluye un token secreto. No hay OAuth. El usuario copia la URL "URL secreta de iCal" de su proveedor. Kino la almacena y la usa en cada sync.

**Seguridad**: la URL .ics se almacena en texto plano en DB. Es aceptable para el scope actual (no es un token OAuth de largo alcance — el usuario puede revocarla desde el proveedor). Para futura mejora: cifrar en reposo.

### Cron re-import

El scheduler diario (`scheduler.service.ts`) puede re-importar calendarios activos. Añadir `importActiveCalendars()` al `runDailySnapshotForActiveUsers`. Límite: solo calendarios de usuarios activos (que hicieron check-in hoy) para no exceder 10s.

---

## 4. Cambios por capa

### 4.1 Schema — `src/shared/db/schema.ts`

Nueva tabla `calendarConnections` con los campos de la sección 3.

Añadir `uniqueIndex` parcial sobre `tasks.external_source`:
```typescript
uniqueIndex('uq_tasks_external_source')
  .on(table.externalSource)
  .where(sql`${table.externalSource} IS NOT NULL`)
```

Migración: `pnpm db:generate` → revisar SQL → `pnpm db:push`.

### 4.2 Dependencias

```bash
pnpm add ical.js
```

### 4.3 Service — `src/features/sync/ics-parser.ts` (nuevo)

Función pura `parseIcsToEvents(icsString: string, fromDate: Date, toDate: Date): ParsedEvent[]`.

```typescript
interface ParsedEvent {
  uid: string;
  title: string;
  description: string | null;
  startAt: Date;    // UTC
  endAt: Date | null;  // UTC
  rrule: string | null;  // Si el evento es recurrente
}
```

Esta función es **completamente pura** (sin efectos) y testeable. El filtrado de rango de fechas ocurre aquí.

**Gotcha**: `ical.js` devuelve fechas timezone-aware. Siempre convertir a UTC con `dt.convertToZone(ICAL.Timezone.utcTimezone).toJSDate()`.

**Gotcha**: un VEVENT recurrente en .ics tiene un solo VEVENT con RRULE. Para este plan, importar solo la primera ocurrencia futura — no expandir la serie completa (performance + complejidad). Si PLAN-06 Capa 1 está completo, se puede setear `recurrenceRule` en la tarea importada.

### 4.4 Service — `src/features/sync/sync.service.ts` (nuevo)

```typescript
export async function importCalendar(userId: string, connectionId: string): Promise<{ imported: number; updated: number; errors: number }>

export async function importActiveCalendars(userId: string): Promise<void>  // para cron
```

`importCalendar`:
1. Obtener `calendarConnection` (verificar propiedad: `user_id = userId`).
2. Fetch del .ics con `fetch(connection.icsUrl, { signal: AbortSignal.timeout(8000) })` — timeout 8s para dejar 2s al resto de la operación dentro del límite Vercel.
3. `parseIcsToEvents(text, now, now + 30 days)`.
4. Upsert en batch de 20 tareas (evitar timeout).
5. Actualizar `last_synced_at` en `calendarConnections`.

### 4.5 Routes — `src/features/sync/sync.routes.ts` (nuevo)

```
POST /api/sync/calendars          → crear conexión (name, ics_url, system_id)
GET  /api/sync/calendars          → listar conexiones del usuario
DELETE /api/sync/calendars/[id]   → eliminar conexión
POST /api/sync/calendars/[id]/sync → importar ahora (manual trigger)
```

### 4.6 API Routes (nuevos)

```
src/app/api/sync/calendars/route.ts       → GET, POST
src/app/api/sync/calendars/[id]/route.ts  → DELETE
src/app/api/sync/calendars/[id]/sync/route.ts → POST
```

### 4.7 UI — `src/features/sync/CalendarConnectionForm.tsx` (nuevo)

Formulario para añadir conexión:
- Campo: nombre del calendario.
- Campo: URL .ics (con enlace a guía "¿Cómo obtener tu URL .ics?").
- Selector de sistema destino.
- Botón "Conectar y sincronizar ahora".

Nota importante en UI: "Kino importa tu calendario en modo lectura. Los cambios que hagas en Kino no se reflejan en tu calendario externo."

### 4.8 UI — `src/features/sync/CalendarConnectionsList.tsx` (nuevo)

Lista de conexiones activas: nombre, last_synced_at, botón "Sincronizar", botón "Eliminar".

### 4.9 Settings — nueva sección en la página de settings

Añadir sección "Calendarios" con `CalendarConnectionForm` + `CalendarConnectionsList`.

### 4.10 Scheduler — `src/features/scheduler/scheduler.service.ts`

Añadir `importActiveCalendars(userId)` al loop de usuarios activos. Ejecutar solo si el usuario tiene conexiones activas (query previa para verificar).

### 4.11 Zod validation

Schema de creación de conexión:
```typescript
z.object({
  name: z.string().min(1).max(255),
  icsUrl: z.string().url().max(2048),
  systemId: z.string().uuid().optional(),
})
```

Validación adicional: verificar que la URL responde con Content-Type correcto en el backend (no confiar en el cliente).

---

## 5. Plan de commits

### Commit 1 — `chore(deps): instalar ical.js para parsing de calendarios`

### Commit 2 — `feat(schema): tabla calendar_connections + unique index en tasks.external_source`
Archivos: `src/shared/db/schema.ts`
Post-commit: `pnpm db:generate` → revisar SQL → `pnpm db:push`

### Commit 3 — `feat(sync): parser .ics puro con filtrado por rango de fechas`
Archivos: `src/features/sync/ics-parser.ts` (nuevo)
Incluye tests unitarios para el parser.

### Commit 4 — `feat(sync): sync.service — importCalendar con upsert en batch`
Archivos: `src/features/sync/sync.service.ts` (nuevo)

### Commit 5 — `feat(sync): rutas CRUD de calendar_connections + sync manual`
Archivos:
- `src/features/sync/sync.routes.ts` (nuevo)
- `src/app/api/sync/calendars/route.ts` (nuevo)
- `src/app/api/sync/calendars/[id]/route.ts` (nuevo)
- `src/app/api/sync/calendars/[id]/sync/route.ts` (nuevo)

### Commit 6 — `feat(sync): CalendarConnectionForm y CalendarConnectionsList`
Archivos:
- `src/features/sync/CalendarConnectionForm.tsx` (nuevo)
- `src/features/sync/CalendarConnectionsList.tsx` (nuevo)
- `src/features/sync/sync.hooks.ts` (nuevo — hooks TanStack Query)

### Commit 7 — `feat(sync): sección Calendarios en Settings`
Archivos: ajustar la página de settings existente.

### Commit 8 — `feat(scheduler): importar calendarios activos en cron diario`
Archivos: `src/features/scheduler/scheduler.service.ts`

Verificar: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`

---

## 6. Tests

### Unitarios — `ics-parser.ts`
```
parseIcsToEvents:
  ✓ evento simple con SUMMARY + DTSTART → ParsedEvent correcto
  ✓ evento con timezone → fecha convertida a UTC
  ✓ evento fuera del rango (hace 31 días) → excluido
  ✓ evento sin SUMMARY → excluido
  ✓ evento sin DTSTART → excluido
  ✓ .ics vacío → array vacío
  ✓ .ics malformado → no lanza, devuelve array vacío con warning
```

### Integración (manual)
- Conectar URL .ics de Google Calendar test → tareas creadas en Inbox.
- Mismo evento importado dos veces → no duplicado.
- Evento modificado en Calendar → re-import actualiza la tarea.
- URL inválida → mensaje de error claro en la UI.
- URL que tarda → no cuelga la UI (timeout 8s).

---

## 7. Checklist de seguridad

- [ ] `userId` de sesión para todas las operaciones sobre `calendarConnections`
- [ ] Verificar propiedad de la conexión antes de sync (no permitir sync de conexiones ajenas)
- [ ] `icsUrl` validada como URL antes de hacer fetch (evitar SSRF a URLs internas)
- [ ] Timeout de fetch para no colgar la request
- [ ] Contenido del .ics parseado de forma defensiva (no asumir estructura)
- [ ] `external_source` no es editable por el cliente (solo el service lo asigna)
- [ ] Premium guard si el sync de calendarios es feature premium

---

## 8. Riesgos y gotchas

- **SSRF (Server-Side Request Forgery)**: el fetch de la URL .ics ocurre en el servidor. Si el usuario provee `http://169.254.169.254/...` (AWS metadata) o URLs internas, podría acceder a recursos internos. Mitigación: validar que la URL es `https://` y que no resuelve a rangos IP privados (10.x.x.x, 192.168.x.x, 172.16-31.x.x, 127.x.x.x, 169.254.x.x). Rechazar en el service si la IP es privada.
- **Calendarios grandes**: algunos .ics tienen años de historial. El filtro de rango de fechas (30 días hacia adelante) es crítico. Sin él, el parse y el INSERT pueden exceder 10s.
- **Eventos recurrentes en .ics**: un VEVENT con RRULE representa múltiples ocurrencias. Para este plan: importar como una sola tarea con `recurrenceRule` (si PLAN-06 está completo) o como evento único sin recurrencia. No expandir la serie.
- **`ical.js` y timezones flotantes**: algunos calendarios usan `DTSTART;VALUE=DATE` (fecha sin hora). Tratar como `00:00:00 UTC` de ese día.
- **URL .ics de Google Calendar privado**: la URL incluye un token único (larga). Si el usuario la comparte o si Kino la expone, el calendario queda expuesto. Nunca devolver la `ics_url` al cliente — solo el `name` y `last_synced_at`.
- **Vercel cron + fetch externo**: el cron diario hace fetch a URLs externas. En entorno de desarrollo (localhost), las URLs de Google Calendar no resolverán. Usar variables de entorno para deshabilitar el re-import en dev.
- **Premium gate**: si el sync es feature premium, el `POST /api/sync/calendars` necesita subscription guard. Definir con Elías antes de implementar.
