CREATE TABLE "rate_limits" (
	"identity" varchar(96) NOT NULL,
	"bucket" varchar(32) NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_identity_bucket_pk" PRIMARY KEY("identity","bucket")
);
--> statement-breakpoint
CREATE INDEX "idx_rate_limits_window" ON "rate_limits" USING btree ("window_start");