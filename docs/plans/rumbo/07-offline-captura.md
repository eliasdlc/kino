# PLAN 07 — Captura offline (cola de mutaciones)

> Origen: Sección A2 Sol3 → Sol1 + Sección F item 5. Esfuerzo S–M.  ROI ★★★.
> Meta de fase (decisión pendiente del análisis): empezar por **captura offline** (barato,
> resuelve el 80% del dolor emocional: "nunca pierdo un pensamiento"). Lectura+cola completa es el paso 2.

## Estado hoy

- Offline real ≈ 0%: `kino-sw.js` solo hace network-first con fallback a `/offline` en navegación.
- **No hay** cola de mutaciones, IndexedDB, ni persistencia de TanStack Query.
- `next-pwa` instalado pero no se usa para esto.
- TanStack Query v5 trae `onlineManager` y soporta persistencia/`persistQueryClient` + paused mutations.
- Riesgo del doble-estado: `status` se deriva de fecha en server; offline esa derivación debe correr en cliente o reconciliarse (ver `tasks.state-machine.ts` y `reconcileTaskStatuses`).

## Estrategia (por fases, no de golpe)
Fase 1: **solo captura** (crear tarea/sticky/nota) funciona offline; el resto muestra estado degradado.
Fase 2: lectura offline (persistir cache) + cola de escritura general con last-write-wins por `updatedAt`.
Reservar el sync engine completo (Replicache/Electric) para Desktop — es L y cambia arquitectura.

---

## Sprint 1 — Detección de conexión y feedback

### Ticket 1.1 — Estado online/offline global
**Estado hoy:** no se expone el estado de red.
**Pasos:**
1. Conectar `onlineManager` de TanStack a `navigator.onLine` + eventos `online`/`offline`.
2. Hook `useOnlineStatus()` y un indicador discreto en la UI ("sin conexión").
**Hecho cuando:** la UI sabe y muestra cuándo está offline.

### Ticket 1.2 — SW: cachear el shell de captura
**Pasos:**
1. Ajustar `kino-sw.js` (o configurar `next-pwa`) para que las rutas/recursos necesarios para abrir la captura rápida estén precacheados.
**Hecho cuando:** estando offline, abrir la app permite llegar al diálogo de captura.

---

## Sprint 2 — Cola de captura offline

### Ticket 2.1 — Persistir mutaciones pausadas
**Estado hoy:** las mutaciones fallan sin reintento si no hay red.
**Pasos:**
1. Configurar `MutationCache` con `networkMode` adecuado y `persistQueryClient` usando `idb-keyval` (añadir dep) como storage.
2. Limitar la persistencia a las mutaciones de **creación** (tarea/sticky/nota) en esta fase.
**Hecho cuando:** crear una tarea offline encola la mutación en IndexedDB en vez de perderla.

### Ticket 2.2 — Reproducir al reconectar
**Pasos:**
1. Al volver `online`, TanStack reanuda las mutaciones pausadas (`resumePausedMutations`).
2. Verificar que el id optimista (`userId:"optimistic"`, patrón ya usado en `tasks.hooks.ts`) se reconcilia con el id real al confirmar.
**Hecho cuando:** lo capturado offline aparece en el server al reconectar, sin duplicados.

### Ticket 2.3 — Feedback de "pendiente de sincronizar"
**Pasos:**
1. Marcar visualmente las entidades creadas offline (badge "pendiente") hasta confirmarse.
**Hecho cuando:** el usuario ve qué está aún por subir.

---

## Sprint 3 (futuro de fase) — Lectura offline + cola general

### Ticket 3.1 — Persistir el cache de lectura
**Pasos:**
1. Extender `persistQueryClient` a las queries de lectura clave (tareas por sistema, hoy).
**Hecho cuando:** offline se pueden ver datos cargados antes.

### Ticket 3.2 — Derivación de status en cliente
**Pasos:**
1. Portar/compartir la derivación status-por-fecha para que offline no muestre estados incoherentes; reconciliar al reconectar.
**Hecho cuando:** offline el `status` mostrado coincide con lo que el server calcularía.

## Riesgos
- Conflictos de merge (sticky con posición, board moves) — last-write-wins por `updatedAt`; documentarlo.
- Doble-estado de tareas — no prometer edición offline compleja en Fase 1, solo captura.

## Nota
Esto es el sucesor real de `PLAN-03-sync.md` (que asumía otra arquitectura). Referenciarlo al ejecutar.
