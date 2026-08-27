CREATE TABLE "cron_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" varchar(64) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean DEFAULT false NOT NULL,
	"error" text,
	"result" jsonb
);
--> statement-breakpoint
CREATE INDEX "idx_cron_runs_job_started" ON "cron_runs" USING btree ("job","started_at");