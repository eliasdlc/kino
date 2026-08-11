-- KIN-135 · Hacer que los índices de mapeo externo sean realmente idempotentes.
--
-- Ordenación: esta migración asume que KIN-92 (0015_busqueda_full_text) ya está
-- en el journal. Ambas ramas salieron de `dev` y son independientes entre sí;
-- si por lo que sea 0016 aterriza antes que 0015, aplicarlas en cualquier orden
-- da el mismo resultado — no se tocan.
--
-- 1. `uq_tasks_external` estaba sobre `(external_source, external_id)`, sin el
--    usuario. El ticket lo señala como la garantía de que reimportar no duplica,
--    y para un solo usuario lo es; pero como `external_source` es literalmente
--    'github' para todo el mundo, dos usuarios que sincronicen el mismo
--    repositorio chocarían en el mismo par: al segundo le reventaría la
--    importación con una violación de unicidad sobre una fila que ni siquiera
--    puede ver. Se recrea incluyendo `user_id`.
--
-- 2. `sprints.external_id` no tenía índice ninguno. El mapeo milestone→sprint
--    necesita el mismo tipo de garantía, con alcance de sistema: un milestone
--    pertenece al repositorio, y el repositorio se declara en un sistema.
--
-- Es seguro recrear ambos: verificado contra Neon antes de escribir esto,
-- `tasks.external_id` y `sprints.external_id` están a cero filas — el andamiaje
-- github-ready nunca se usó, que es justamente lo que este ticket viene a
-- estrenar. No hay datos que puedan violar la nueva unicidad.
--
-- Vuelta atrás (recrear el índice antiguo, sin `user_id`):
--   DROP INDEX IF EXISTS "uq_sprints_external";
--   DROP INDEX IF EXISTS "uq_tasks_external";
--   CREATE UNIQUE INDEX "uq_tasks_external" ON "tasks"
--     USING btree ("external_source","external_id") WHERE "external_id" IS NOT NULL;

DROP INDEX IF EXISTS "uq_tasks_external";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_tasks_external" ON "tasks" USING btree ("user_id","external_source","external_id") WHERE "tasks"."external_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_sprints_external" ON "sprints" USING btree ("system_id","external_id") WHERE "sprints"."external_id" IS NOT NULL;
