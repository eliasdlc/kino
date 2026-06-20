# PLAN 14 — Diferenciadores caros (futuro)

> Origen: Sección F item 6 + B6 Sol2 (dependencias), C3 (colaboración), B3/B10 (Desktop+local+sync).
> Esfuerzo L. ROI ★. **Roadmap, no detalle fino**: estas piezas son grandes y/o cambian
> arquitectura. No se ejecutan hasta cerrar los planes 01–13 y resolver sus decisiones de producto.
> Aquí se documenta el rumbo y los prerrequisitos, con tickets gruesos.

## Por qué van al final
Cada una es un proyecto: dependencias = grafos/ciclos; colaboración real = multi-tenant + CRDT;
Desktop+sync = motor local-first. Meterlas antes de pulir el core contradice la tesis (A4/F).

---

## Bloque 1 — Dependencias de tareas (`blocked_by` / `blocks`)

> B6 Sol2. **Solo en `system_type project`** (donde tiene sentido), no global.
> Es lo que ni Todoist hace bien. Esfuerzo M–L.

### Estado hoy
- `parentTaskId` (jerarquía) existe; **dependencias NO**. No hay tabla de aristas.
- `tasks.state-machine.ts` es función pura testeable (buen hogar para las reglas).

### Tickets gruesos
1. **Tabla de aristas** `task_dependencies` (`blocker_id`, `blocked_id`, FK + índices). Migración.
2. **Prevención de ciclos**: validación pura (DFS) antes de crear una arista. Tests obligatorios (grafos = ciclos).
3. **Regla en la state-machine**: una tarea no entra a `today` si su bloqueante no está `done`.
4. **UI en el board de `project`**: marcar "bloqueada por" / "bloquea", indicador visual, no dejar arrastrar a hacer si está bloqueada.
5. **MCP**: exponer crear/quitar dependencia (reusa patrón de tools existentes).

### Riesgos
- Ciclos; afecta la derivación de status (tarea bloqueada no debe auto-derivar a today).

---

## Bloque 2 — Publicar cuaderno read-only por link

> C3 Sol1. Puente barato hacia colaboración, **antes** que colaboración real. Esfuerzo S–M.
> (Este es el más barato del plan; podría adelantarse si se quiere un quick win de "compartir".)

### Estado hoy
- Editor reusable; ya se proxean rutas públicas (commit reciente); route group `(marketing)` existe.

### Tickets gruesos
1. Flag `isPublic` + `publicSlug` en `pages` (migración).
2. Ruta pública `(marketing)/p/[slug]` que renderiza el HTML del cuaderno en **modo read-only** (Tiptap `editable:false` o render estático del HTML).
3. Botón "Publicar / copiar enlace" en el editor, con toggle de privacidad.
4. Seguridad: solo expone páginas marcadas públicas; nada más.

### Anti-objetivo
- Edición colaborativa real (Yjs/CRDT) → Bloque 4, no aquí.

---

## Bloque 3 — Colaboración asíncrona (comentarios/menciones)

> C3 Sol2. Sin edición simultánea (evita CRDTs). Esfuerzo L. Depende de multi-tenant.

### Tickets gruesos (esbozo)
1. Resolver primero el modelo multi-tenant (hoy single-user por diseño — ver memoria `project`).
2. Tabla de comentarios ligada a página/tarea.
3. Menciones + notificaciones (reusa el sistema de push existente).

### Nota
No empezar sin decidir multi-tenant; cambia auth/datos. Es "muy futura" por tu propia nota.

---

## Bloque 4 — Desktop + archivos locales + sync (local-first)

> B3 Sol3 / B10 Sol2. Esfuerzo L. Es **una sola inversión** junto con el offline (Plan 07).

### Estado hoy
- PWA, server-as-source-of-truth. Offline ≈ 0% (Plan 07 lo arranca).

### Tickets gruesos (esbozo)
1. Diseñar el sync **como** la cola de mutaciones + persistencia del Plan 07 (no construir sync dos veces).
2. App Desktop (Tauri/Electron) con espejo en disco: cuadernos `.md` + tareas `.json` (lo que Obsidian da y Notion no).
3. Motor de sync (evaluar Replicache/ElectricSQL/PowerSync) — cambio de arquitectura, decisión mayor.
4. Resolución de conflictos diseñada desde el inicio (last-write-wins por `updatedAt` como base).

### Anti-objetivo
- E2E encryption mientras el server procese datos (energía/crons): **no prometer**.

---

## Edición colaborativa en tiempo real (mención, no plan)
Tiptap + Yjs (CRDT) es el techo de C3 Sol3: cambia el modelo de single-user a workspaces.
Diferenciador enorme pero caro. No entra en este rumbo; se evalúa después de Bloques 1–4.

---

## Resumen de prerrequisitos
- Bloque 1: ninguno técnico fuerte (pero después de pulir core).
- Bloque 2: el más barato; reusa público + editor read-only.
- Bloque 3: requiere decisión multi-tenant.
- Bloque 4: requiere el Plan 07 (offline) como base de sync.
