CREATE TABLE "energy_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"slot" "checkin_slot" NOT NULL,
	"predicted_level" smallint NOT NULL,
	"alpha_at_prediction" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prediction_level_range" CHECK ("energy_predictions"."predicted_level" BETWEEN 1 AND 100)
);
--> statement-breakpoint
ALTER TABLE "energy_checkins" ADD COLUMN "alpha_before" double precision;--> statement-breakpoint
ALTER TABLE "energy_checkins" ADD COLUMN "alpha_after" double precision;--> statement-breakpoint
ALTER TABLE "energy_predictions" ADD CONSTRAINT "energy_predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_prediction_slot" ON "energy_predictions" USING btree ("user_id","date","slot");--> statement-breakpoint
CREATE INDEX "idx_prediction_user" ON "energy_predictions" USING btree ("user_id","date");