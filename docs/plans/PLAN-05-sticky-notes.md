# PLAN-05 — Sticky Notes: de decoración a captura accionable

> Prioridad: 2 (autónomo, pequeño, aclara confusión de producto)
> Rama: `feat/plan-05-sticky-capture`
> Depende de: ninguno
> Desbloquea: ninguno

---

## 1. Contexto y diagnóstico

### Lo que existe hoy

Las sticky notes tienen schema, CRUD completo, y UI de grilla. Lo que no tienen es **un verbo que las diferencie de tareas y páginas**.

| Aspecto | Estado actual | Problema |
|---|---|---|
| Schema | `stickyNotes` con `pageId`, `folderId`, `title`, `content`, `color` | No tiene `systemId` ni `taskId` — no puede convertirse en tarea directamente |
| UI | `StickyNoteCard.tsx`, `StickyNotesGrid.tsx` | Sin acción "→ tarea" |
| Service | `sticky-notes.service.ts` | CRUD puro, sin integración con tasks |
| Rol en el producto | Sin definir | El usuario no sabe qué son |

### El rol que se les asigna

**Captura rápida → triage.** Una sticky note es un pensamiento crudo sin fricción: sin sistema obligatorio, sin energyLevel, sin fecha. Acumula notas que luego se procesan con dos acciones:

1. **→ Tarea**: crea una tarea en el Inbox (o en el sistema donde vive la nota) con el título/contenido de la nota, y elimina la nota.
2. **Archivar**: descarta la nota sin crear tarea.

Esto convierte las stickies en el *front-end* del embudo de energía, no en un competidor de páginas.

### Por qué no añadir `systemId` al schema

Añadir `system_id` requeriría migración y complicaría la captura rápida (un campo extra obligatorio anula la "sin fricción"). La conversión a tarea ya puede inferir el sistema: si la nota está en una página dentro de un sistema, usar ese sistema. Si no, Inbox.

---

## 2. Objetivo y criterios de aceptación

- [ ] `StickyNoteCard` tiene botón "Convertir en tarea" (ícono o texto pequeño).
- [ ] Al convertir: se crea una tarea en el Inbox del usuario con `title = nota.title`, `description = nota.content`.
- [ ] Si la nota está en una página con `systemId` inferible, usar ese sistema. Si no, Inbox.
- [ ] Tras crear la tarea, la nota se elimina (soft-delete no aplica a stickies — no tienen `deleted_at`).
- [ ] La acción es optimista: la nota desaparece de UI inmediatamente, rollback si falla.
- [ ] `StickyNoteCard` tiene botón "Archivar" (ya existe como delete — solo confirmar que el UX es claro).
- [ ] La grilla tiene un texto de contexto: "Capturas rápidas — procésalas o conviértelas en tareas."
- [ ] `pnpm typecheck && pnpm lint && pnpm build && pnpm test` pasan.

---

## 3. Decisiones de diseño

### Inferencia del sistema al convertir

```
si nota.pageId → buscar la página → buscar su system_id → usar ese sistema
si nota.folderId → buscar la carpeta → buscar su system_id → usar ese sistema
si nada → usar Inbox del usuario (is_inbox = true)
```

Esto no requiere schema nuevo. Solo una función de inferencia en el service.

### Flujo de conversión (API)

Nueva ruta `POST /api/sticky-notes/[id]/convert-to-task`. Devuelve la tarea creada. El cliente elimina la sticky note del caché TanStack Query y añade la tarea al caché del sistema destino.

Alternativamente, hacerlo en un solo endpoint que haga ambas cosas atómicamente. Preferible para consistencia — si falla la creación de tarea, no se borra la nota.

**Decisión: transacción atómica en el service.** Un solo endpoint, una sola transacción DB: `INSERT INTO tasks ... ; DELETE FROM sticky_notes WHERE id = $id`. Si cualquiera falla, rollback.

### UX del botón

En `StickyNoteCard`, en el hover o menú de contexto (ya existe DropdownMenu):
```
⟶ Convertir en tarea
🗑 Eliminar
```

No hace falta confirm dialog para "convertir" — es reversible (la tarea se puede borrar). El "Eliminar" directo sí puede tener confirm si el contenido es largo.

---

## 4. Cambios por capa

### 4.1 Service — `src/features/sticky-notes/sticky-notes.service.ts`

Nueva función `convertToTask(userId, noteId)`:

```typescript
async function convertToTask(userId: string, noteId: string): Promise<Task> {
  // 1. Buscar la nota (verificar que pertenece al userId)
  // 2. Inferir systemId (pageId → página → sistema, folderId → carpeta → sistema, else Inbox)
  // 3. Transacción: INSERT task + DELETE sticky_note
  // 4. Devolver la tarea creada
}
```

La inferencia usa queries a `pages` y `folders` (ya importados en el slice). El Inbox se obtiene con `db.select().from(systems).where(eq(systems.isInbox, true)).and(eq(systems.userId, userId))`.

**Importante:** el `userId` en el `INSERT` de la tarea viene de la sesión, no del body ni de la nota. La nota solo provee `title`, `content`, `systemId` inferido.

### 4.2 Schemas — `src/features/sticky-notes/sticky-notes.schemas.ts`

No requiere schema nuevo para la conversión (no hay input del cliente — solo el `id` en la URL).

### 4.3 Route — `src/features/sticky-notes/sticky-notes.routes.ts`

Nueva función `convertToTaskRoute(request, params)`:

```typescript
// POST /api/sticky-notes/[id]/convert-to-task
// Sin body. userId de sesión. noteId de params.
// Responde: 201 + Task creada
```

### 4.4 API Route — `src/app/api/sticky-notes/[id]/convert-to-task/route.ts` (nuevo)

```typescript
export const POST = convertToTaskRoute;
```

### 4.5 Hook — `src/features/sticky-notes/sticky-notes.hooks.ts`

Nueva mutación `useConvertStickyToTask(systemId?)`:

```typescript
// useMutation → POST /api/sticky-notes/[id]/convert-to-task
// onMutate: eliminar nota del caché optimísticamente
// onSuccess: invalidar ['tasks', systemId] para que aparezca la tarea
// onError: restaurar nota en caché + toast
```

La invalidación de tasks usa el `systemId` inferido que devuelve el servidor en la respuesta.

### 4.6 UI — `src/features/sticky-notes/StickyNoteCard.tsx`

Añadir al DropdownMenu (ya existe):
```tsx
<DropdownMenuItem onClick={() => convertToTask(note.id)}>
  <ArrowRight className="size-4" />
  Convertir en tarea
</DropdownMenuItem>
```

Estado de loading mientras la mutación está en curso (deshabilitar el item).

### 4.7 UI — `src/features/sticky-notes/StickyNotesGrid.tsx`

Añadir texto de contexto en el header:
```tsx
<p className="text-xs text-muted-foreground">
  Capturas rápidas · conviértelas en tareas o descártalas
</p>
```

---

## 5. Plan de commits

### Commit 1 — `feat(sticky-notes): convertToTask con inferencia de sistema y transacción atómica`
Archivos: `src/features/sticky-notes/sticky-notes.service.ts`

Cambios:
- Función `convertToTask(userId, noteId)`.
- Inferencia de `systemId` desde página/carpeta/inbox.
- Transacción DB: INSERT task + DELETE sticky_note.

Verificar: `pnpm typecheck`

### Commit 2 — `feat(sticky-notes): ruta POST /api/sticky-notes/[id]/convert-to-task`
Archivos:
- `src/features/sticky-notes/sticky-notes.routes.ts`
- `src/app/api/sticky-notes/[id]/convert-to-task/route.ts` (nuevo)

Cambios:
- Handler que valida sesión y llama al service.
- Responde `201` con la tarea creada.

Verificar: `pnpm typecheck && pnpm lint`

### Commit 3 — `feat(sticky-notes): hook useConvertStickyToTask con optimistic UI`
Archivos: `src/features/sticky-notes/sticky-notes.hooks.ts`

Cambios:
- Mutación con `onMutate` (eliminar nota del caché), `onSuccess` (invalidar tasks), `onError` (restaurar nota + toast).

Verificar: `pnpm typecheck`

### Commit 4 — `feat(sticky-notes): botón "convertir en tarea" en StickyNoteCard + contexto en grid`
Archivos:
- `src/features/sticky-notes/StickyNoteCard.tsx`
- `src/features/sticky-notes/StickyNotesGrid.tsx`

Cambios:
- Item en DropdownMenu con loading state.
- Texto de contexto en la grilla.

Verificar: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`

---

## 6. Tests

### Unitarios — `src/features/sticky-notes/sticky-notes.service.test.ts` (nuevo)
```
convertToTask:
  ✓ nota con pageId → tarea en sistema de la página
  ✓ nota con folderId → tarea en sistema de la carpeta
  ✓ nota sin pageId ni folderId → tarea en Inbox
  ✓ nota de otro userId → error 403
  ✓ nota inexistente → error 404
```

### Integración (manual)
- Crear sticky note en una página de sistema X → convertir → tarea aparece en sistema X.
- Crear sticky note en una página sin sistema → convertir → tarea aparece en Inbox.
- La sticky note desaparece de la grilla inmediatamente.
- Fallo de red → nota vuelve a aparecer + toast.

---

## 7. Checklist de seguridad

- [ ] `userId` de sesión para verificar propiedad de la nota
- [ ] `userId` de sesión en el `INSERT` de la tarea (nunca de la nota)
- [ ] Verificar que `noteId` pertenece al `userId` antes de operar
- [ ] Transacción atómica — no delete sin insert exitoso
- [ ] Respuesta de error normalizada `{ code, message }`

---

## 8. Riesgos y gotchas

- **Soft delete en stickies**: las sticky notes no tienen `deleted_at` — el DELETE es hard. Confirmar antes de ejecutar la transacción (la tarea ya fue creada en la misma transacción, así que si el DELETE falla, todo el rollback revierte ambos).
- **Inbox no encontrado**: si el usuario no tiene Inbox (no debería pasar, pero el sistema lo garantiza al onboarding), la función debe lanzar error claro, no crear una tarea con `system_id` null (violación de constraint).
- **Cache invalidation de tasks**: el `systemId` para invalidar el caché de tasks lo devuelve la respuesta del servidor. El hook debe usarlo, no asumirlo.
- **TanStack Query key de sticky notes**: verificar que la key incluye todos los filtros (página/carpeta) para que el `onMutate` optimista borre del caché correcto.
