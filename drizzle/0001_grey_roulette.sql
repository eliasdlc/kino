DROP TABLE "energy_logs" CASCADE;--> statement-breakpoint
DROP TABLE "inventory_items" CASCADE;--> statement-breakpoint
DROP TABLE "quests" CASCADE;--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN "peak_energy_start";--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN "peak_energy_end";--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN "brain_dump_default_system";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "xp_total";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "coins";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "last_sync_date";--> statement-breakpoint
DROP TYPE "public"."item_type";--> statement-breakpoint
DROP TYPE "public"."quest_type";