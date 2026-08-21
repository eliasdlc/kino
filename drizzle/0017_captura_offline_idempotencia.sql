ALTER TABLE "pages" ADD COLUMN "client_request_id" uuid;--> statement-breakpoint
ALTER TABLE "sticky_notes" ADD COLUMN "client_request_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "client_request_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pages_client_request" ON "pages" USING btree ("user_id","client_request_id") WHERE "pages"."client_request_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sticky_client_request" ON "sticky_notes" USING btree ("user_id","client_request_id") WHERE "sticky_notes"."client_request_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tasks_client_request" ON "tasks" USING btree ("user_id","client_request_id") WHERE "tasks"."client_request_id" IS NOT NULL;