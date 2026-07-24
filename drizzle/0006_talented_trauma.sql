CREATE TYPE "public"."entity_type" AS ENUM('character', 'location', 'object', 'concept', 'event', 'faction', 'other');--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"system_id" uuid NOT NULL,
	"type" "entity_type" DEFAULT 'character' NOT NULL,
	"name" varchar(255) NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text,
	"attributes" jsonb,
	"cover_image_url" text,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_entity_id" uuid NOT NULL,
	"to_entity_id" uuid NOT NULL,
	"label" varchar(100),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_entity_mentions" (
	"page_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"mention_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "page_entity_mentions_page_id_entity_id_pk" PRIMARY KEY("page_id","entity_id")
);
--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relations" ADD CONSTRAINT "entity_relations_from_entity_id_entities_id_fk" FOREIGN KEY ("from_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relations" ADD CONSTRAINT "entity_relations_to_entity_id_entities_id_fk" FOREIGN KEY ("to_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_entity_mentions" ADD CONSTRAINT "page_entity_mentions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_entity_mentions" ADD CONSTRAINT "page_entity_mentions_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_entities_system" ON "entities" USING btree ("system_id") WHERE "entities"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_entities_user" ON "entities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_entity_relations_from" ON "entity_relations" USING btree ("from_entity_id");--> statement-breakpoint
CREATE INDEX "idx_entity_relations_to" ON "entity_relations" USING btree ("to_entity_id");--> statement-breakpoint
CREATE INDEX "idx_page_entity_mentions_page" ON "page_entity_mentions" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "idx_page_entity_mentions_entity" ON "page_entity_mentions" USING btree ("entity_id");