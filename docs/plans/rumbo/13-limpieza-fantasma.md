# PLAN 13 — Limpieza de features fantasma (matar quests / inventory)

> Origen: Sección E item 9 (B8). Esfuerzo S. ROI ★★★.
> Decisión ya tomada: **matar** `quests` e `inventoryItems`. Tu postura anti-rachas/anti-puntos
> lo respalda. Quitan deuda conceptual sin aportar valor.

## Estado hoy (verificado en código)

- `quests` (`schema.ts:1007`) e `inventoryItems` (`schema.ts:1036`): **0 usos en código de app**.
  El `grep` de "quest"/"inventory" en `src/` solo da falsos positivos (la palabra "request").
- Enums asociados solo a estas tablas: `questTypeEnum` (:109), `itemTypeEnum` (:133),
  `frequencyEnum` (:127). **Verificar** que `frequencyEnum` no lo use otra cosa antes de borrarlo.
- **Ojo, NO es lo mismo:** el sistema de **XP está vivo** — `users.xpTotal` se incrementa en
  `tasks.service.ts:142-147` vía side effects `grant_xp`/`revert_xp` de `tasks.state-machine.ts`.
  Eso **no** se toca en este plan (es un mecanismo aparte y funcional). Ver Ticket 3.1.

## Estrategia
Borrado limpio de tablas/enums huérfanos con una migración. Confirmar primero que de verdad
no hay datos que importe perder ni código que dependa.

---

## Sprint 1 — Confirmar que están realmente muertas

### Ticket 1.1 — Verificación de dependencias
**Pasos:**
1. `grep -rn "quests\|inventoryItems\|questType\|itemType\|frequencyEnum" src` y confirmar 0 usos reales.
2. Confirmar que ninguna ruta/MCP tool/servicio las consume.
**Hecho cuando:** queda escrito que no hay consumidores.

### Ticket 1.2 — Confirmar que no hay datos valiosos
**Pasos:**
1. `db:studio` o query: `SELECT count(*) FROM quests; SELECT count(*) FROM inventory_items;`.
2. Si hay filas, confirmar con el dueño que son descartables (en dev casi seguro vacías).
**Hecho cuando:** se confirma que borrar no pierde nada que importe.

---

## Sprint 2 — Borrado

### Ticket 2.1 — Quitar del schema
**Pasos:**
1. En `schema.ts`, eliminar `quests`, `inventoryItems` y los enums `questTypeEnum`, `itemTypeEnum`
   (y `frequencyEnum` **solo si** el Ticket 1.1 confirmó que no se usa en otro lado).
2. Eliminar imports muertos resultantes.
**Hecho cuando:** el schema compila sin esas definiciones.

### Ticket 2.2 — Generar y aplicar la migración
**Pasos:**
1. `pnpm db:generate` → revisar el SQL `DROP TABLE` generado (siguiente número, 0010+).
2. Revisar manualmente que solo dropea lo esperado (tablas + enums), nada más.
3. `pnpm db:push` (o aplicar la migración) en dev.
**Hecho cuando:** la base ya no tiene esas tablas/enums y la app arranca igual.

### Ticket 2.3 — Verificación post-borrado
**Pasos:**
1. `pnpm typecheck` + `pnpm build` + smoke test de completar una tarea (que el XP siga subiendo).
**Hecho cuando:** todo verde y completar tareas sigue sumando XP.

---

## Sprint 3 — Decisión pendiente sobre XP (separada)

### Ticket 3.1 — ¿XP se queda, se reencuadra o se mata?
**Estado hoy:** `users.xpTotal` sube al completar (vivo, pero ¿se muestra en algún lado útil?).
**Pasos:**
1. Buscar dónde se muestra `xpTotal` (si en ningún lado, es semi-fantasma también).
2. Decisión de producto: (a) dejarlo como métrica interna, (b) reencuadrarlo como "progreso sano"
   (Plan 02 / B8 Sol1), o (c) matarlo como las rachas.
3. **No** ejecutar aquí: solo dejar la decisión registrada para no repetir el limbo de quests.
**Hecho cuando:** hay una decisión escrita sobre XP (no queda en limbo como quedaron quests).

## Anti-objetivo
- No construir un sistema de puntos/rachas nuevo. La "gamificación" sana de Kino es el advisor/energía (Plan 02).
