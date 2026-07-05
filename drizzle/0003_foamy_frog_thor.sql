-- Backfill previo al CHECK: filas con status de scheduling legacy fuera del set
-- de la state machine (en prod, 12 tareas `project` soft-deleted con status='action',
-- valor de board/tab que se filtró al scheduling antes de separar status/board_status
-- en 0006). Todas en papelera; se normalizan a 'backlog' (bucket neutro sin agendar),
-- conservando deleted_at. En una DB fresca no hay tales filas → no-op.
UPDATE "tasks" SET "status" = 'backlog' WHERE "status" NOT IN ('backlog', 'week', 'tomorrow', 'today', 'done');--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'backlog';--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_valid" CHECK ("tasks"."status" IN ('backlog', 'week', 'tomorrow', 'today', 'done'));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_board_status_non_empty" CHECK ("tasks"."board_status" IS NULL OR length("tasks"."board_status") > 0);