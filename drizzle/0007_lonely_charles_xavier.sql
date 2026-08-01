ALTER TYPE "public"."time_source" ADD VALUE 'writing';--> statement-breakpoint
ALTER TABLE "time_logs" ALTER COLUMN "task_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "time_logs" ADD COLUMN "page_id" uuid;--> statement-breakpoint
ALTER TABLE "time_logs" ADD COLUMN "words_written" integer;--> statement-breakpoint
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_timelogs_page" ON "time_logs" USING btree ("user_id","page_id","started_at") WHERE "time_logs"."page_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "time_logs" ADD CONSTRAINT "time_log_single_target" CHECK (("time_logs"."task_id" IS NULL) <> ("time_logs"."page_id" IS NULL));