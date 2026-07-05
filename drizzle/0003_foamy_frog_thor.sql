ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'backlog';--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_valid" CHECK ("tasks"."status" IN ('backlog', 'week', 'tomorrow', 'today', 'done'));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_board_status_non_empty" CHECK ("tasks"."board_status" IS NULL OR length("tasks"."board_status") > 0);