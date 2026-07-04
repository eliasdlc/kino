CREATE TYPE "public"."account_status" AS ENUM('active', 'banned');--> statement-breakpoint
CREATE TYPE "public"."auth_provider" AS ENUM('local', 'google', 'github');--> statement-breakpoint
CREATE TYPE "public"."checkin_slot" AS ENUM('morning', 'afternoon', 'evening');--> statement-breakpoint
CREATE TYPE "public"."chronotype" AS ENUM('morning', 'intermediate', 'evening');--> statement-breakpoint
CREATE TYPE "public"."color" AS ENUM('red', 'blue', 'pink', 'purple', 'green', 'orange', 'yellow', 'teal', 'gray', 'black', 'white');--> statement-breakpoint
CREATE TYPE "public"."energy_level" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."frequency" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('freeze', 'theme', 'sticker', 'boost');--> statement-breakpoint
CREATE TYPE "public"."prediction_accuracy" AS ENUM('accurate', 'partial', 'inaccurate');--> statement-breakpoint
CREATE TYPE "public"."profile_type" AS ENUM('student', 'freelancer', 'corporate');--> statement-breakpoint
CREATE TYPE "public"."quest_type" AS ENUM('consistency', 'milestone', 'recovery');--> statement-breakpoint
CREATE TYPE "public"."reminder_source" AS ENUM('auto', 'user');--> statement-breakpoint
CREATE TYPE "public"."sleep_quality" AS ENUM('good', 'partial', 'poor');--> statement-breakpoint
CREATE TYPE "public"."sprint_status" AS ENUM('active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."sync_provider" AS ENUM('google_calendar', 'jira', 'slack', 'microsoft_teams', 'notion', 'ical', 'github');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('backlog', 'week', 'tomorrow', 'today', 'done', 'archived');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('task', 'idea', 'event', 'reminder', 'epic', 'habit', 'todo', 'project');--> statement-breakpoint
CREATE TYPE "public"."template_type" AS ENUM('academic', 'project', 'entrepreneurial', 'personal', 'custom', 'inbox');--> statement-breakpoint
CREATE TYPE "public"."time_source" AS ENUM('pomodoro', 'manual', 'timer');--> statement-breakpoint
CREATE TYPE "public"."ui_theme" AS ENUM('dark', 'light', 'system');--> statement-breakpoint
CREATE TYPE "public"."weekday" AS ENUM('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" varchar(500),
	"password" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"key_prefix" varchar(14) NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "behavior_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"tasks_created" smallint DEFAULT 0 NOT NULL,
	"tasks_completed" smallint DEFAULT 0 NOT NULL,
	"tasks_overdue" smallint DEFAULT 0 NOT NULL,
	"critical_count" smallint DEFAULT 0 NOT NULL,
	"active_count" smallint DEFAULT 0 NOT NULL,
	"completion_rate" double precision DEFAULT 0 NOT NULL,
	"learning_alpha" double precision DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "context_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"system_id" uuid,
	"title" varchar(24) NOT NULL,
	"color" "color" DEFAULT 'blue' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "default_context_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_type" "profile_type" NOT NULL,
	"title" varchar(24) NOT NULL,
	"color" "color" DEFAULT 'blue' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "energy_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"slot" "checkin_slot" DEFAULT 'morning' NOT NULL,
	"current_level" smallint NOT NULL,
	"sleep_quality" "sleep_quality" NOT NULL,
	"prediction_accuracy" "prediction_accuracy",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkin_level_range" CHECK ("energy_checkins"."current_level" BETWEEN 1 AND 100)
);
--> statement-breakpoint
CREATE TABLE "energy_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"energy_value" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "energy_value_range" CHECK ("energy_logs"."energy_value" BETWEEN 1 AND 100)
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"system_id" uuid,
	"parent_id" uuid,
	"name" varchar(255) NOT NULL,
	"color" "color" DEFAULT 'blue' NOT NULL,
	"path" "ltree" NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_type" "item_type" NOT NULL,
	"item_key" varchar(100) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"coin_cost" integer NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jwks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "oauth_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"session_id" uuid,
	"user_id" uuid,
	"reference_id" varchar(255),
	"refresh_id" uuid,
	"scopes" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_access_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "oauth_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"client_secret" text,
	"disabled" boolean DEFAULT false,
	"skip_consent" boolean,
	"enable_end_session" boolean,
	"subject_type" varchar(50),
	"scopes" jsonb,
	"user_id" uuid,
	"name" varchar(255),
	"uri" text,
	"icon" text,
	"contacts" jsonb,
	"tos" text,
	"policy" text,
	"software_id" varchar(255),
	"software_version" varchar(100),
	"software_statement" text,
	"redirect_uris" jsonb NOT NULL,
	"post_logout_redirect_uris" jsonb,
	"token_endpoint_auth_method" varchar(50),
	"grant_types" jsonb,
	"response_types" jsonb,
	"public" boolean,
	"type" varchar(50),
	"require_pkce" boolean,
	"reference_id" varchar(255),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_clients_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"user_id" uuid,
	"reference_id" varchar(255),
	"scopes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"session_id" uuid,
	"user_id" uuid NOT NULL,
	"reference_id" varchar(255),
	"scopes" jsonb NOT NULL,
	"auth_time" timestamp with time zone,
	"revoked" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "page_tags" (
	"page_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "page_tags_page_id_tag_id_pk" PRIMARY KEY("page_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"folder_id" uuid,
	"system_id" uuid,
	"parent_page_id" uuid,
	"title" varchar(500),
	"content" text,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"auth_key" text NOT NULL,
	"p256dh_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"system_id" uuid,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"quest_type" "quest_type" NOT NULL,
	"frequency" "frequency" DEFAULT 'daily' NOT NULL,
	"target_value" integer NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"expires_at" date NOT NULL,
	"completed_at" timestamp with time zone,
	"reward_xp" integer NOT NULL,
	"reward_coins" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"system_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"goal" varchar(500),
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"status" "sprint_status" DEFAULT 'active' NOT NULL,
	"completed_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"external_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sticky_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"page_id" uuid,
	"folder_id" uuid,
	"title" varchar(200),
	"content" varchar(500),
	"color" "color" DEFAULT 'yellow' NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"position_side" varchar(10),
	"position_y" real,
	"position_x" real,
	"anchor_id" varchar(36),
	"stack_id" uuid,
	"text_anchor" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sticky_note_location" CHECK (("sticky_notes"."page_id" IS NOT NULL AND "sticky_notes"."folder_id" IS NULL) OR ("sticky_notes"."page_id" IS NULL AND "sticky_notes"."folder_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "sync_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "sync_provider" NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text,
	"feed_url" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"system_id" uuid NOT NULL,
	"date" date NOT NULL,
	"was_active" boolean DEFAULT false NOT NULL,
	"tasks_completed" integer DEFAULT 0 NOT NULL,
	"minutes_logged" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_status_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"system_type" "template_type" NOT NULL,
	"status_name" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"position" smallint NOT NULL,
	"emoji" varchar(10)
);
--> statement-breakpoint
CREATE TABLE "systems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"color" "color" DEFAULT 'blue' NOT NULL,
	"identity_statement" varchar(500),
	"template_type" "template_type" DEFAULT 'custom' NOT NULL,
	"energy_ideal" "energy_level",
	"icon" varchar(50) DEFAULT 'folder' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_inbox" boolean DEFAULT false NOT NULL,
	"expected_frequency" varchar(20),
	"trigger_context" varchar(255),
	"metadata" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_page_links" (
	"task_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	CONSTRAINT "task_page_links_task_id_page_id_pk" PRIMARY KEY("task_id","page_id")
);
--> statement-breakpoint
CREATE TABLE "task_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"remind_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"label" varchar(255),
	"source" "reminder_source" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"system_id" uuid NOT NULL,
	"parent_task_id" uuid,
	"title" varchar(500) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'today' NOT NULL,
	"board_status" varchar(50),
	"board_status_changed_at" timestamp with time zone,
	"energy_level" "energy_level" DEFAULT 'medium' NOT NULL,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"task_type" "task_type",
	"due_date" timestamp with time zone,
	"start_date" timestamp with time zone,
	"estimated_time" time,
	"recurrence_rule" varchar(500),
	"recurrence_parent_id" uuid,
	"folder_id" uuid,
	"context_tag_id" uuid,
	"sprint_id" uuid,
	"external_source" varchar(255),
	"external_id" varchar(255),
	"sort_index" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"in_today_plan" boolean DEFAULT false NOT NULL,
	"notified_before_day" boolean DEFAULT false NOT NULL,
	"notified_due_day" boolean DEFAULT false NOT NULL,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"last_reminded_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"system_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_minutes" integer NOT NULL,
	"source" time_source DEFAULT 'timer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "duration_minutes_non_negative" CHECK ("time_logs"."duration_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_energy_profile" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"chronotype" "chronotype" DEFAULT 'intermediate' NOT NULL,
	"sleep_typical_hours" smallint DEFAULT 7 NOT NULL,
	"available_hours_per_day" smallint DEFAULT 8 NOT NULL,
	"energy_floor" smallint DEFAULT 20 NOT NULL,
	"recharge_presets" text DEFAULT '[]' NOT NULL,
	"learned_curve" text DEFAULT '[]' NOT NULL,
	"learning_alpha" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"profile_type" "profile_type",
	"onboarding_version" integer DEFAULT 1 NOT NULL,
	"peak_energy_start" time,
	"peak_energy_end" time,
	"weekly_review_day" "weekday" DEFAULT 'sun' NOT NULL,
	"brain_dump_default_system" uuid,
	"daily_reset_time" time DEFAULT '00:00' NOT NULL,
	"today_plan_date" date,
	"daily_energy_limit" smallint DEFAULT 50 NOT NULL,
	"focus_timeout_hours" smallint DEFAULT 3 NOT NULL,
	"theme" "ui_theme" DEFAULT 'system' NOT NULL,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" varchar(100) NOT NULL,
	"image" text,
	"provider" "auth_provider" DEFAULT 'local' NOT NULL,
	"provider_id" varchar(255),
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"xp_total" integer DEFAULT 0 NOT NULL,
	"coins" integer DEFAULT 0 NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"timezone" varchar(50) DEFAULT 'America/Santo_Domingo' NOT NULL,
	"last_sync_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behavior_snapshots" ADD CONSTRAINT "behavior_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_tags" ADD CONSTRAINT "context_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_tags" ADD CONSTRAINT "context_tags_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "energy_checkins" ADD CONSTRAINT "energy_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "energy_logs" ADD CONSTRAINT "energy_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_refresh_id_oauth_refresh_tokens_id_fk" FOREIGN KEY ("refresh_id") REFERENCES "public"."oauth_refresh_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD CONSTRAINT "oauth_clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_consents" ADD CONSTRAINT "oauth_consents_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_consents" ADD CONSTRAINT "oauth_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_tags" ADD CONSTRAINT "page_tags_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_tags" ADD CONSTRAINT "page_tags_tag_id_context_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."context_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_parent_page_id_pages_id_fk" FOREIGN KEY ("parent_page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sticky_notes" ADD CONSTRAINT "sticky_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sticky_notes" ADD CONSTRAINT "sticky_notes_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sticky_notes" ADD CONSTRAINT "sticky_notes_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_connections" ADD CONSTRAINT "sync_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_health" ADD CONSTRAINT "system_health_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_health" ADD CONSTRAINT "system_health_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "systems" ADD CONSTRAINT "systems_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_page_links" ADD CONSTRAINT "task_page_links_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_page_links" ADD CONSTRAINT "task_page_links_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_reminders" ADD CONSTRAINT "task_reminders_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_reminders" ADD CONSTRAINT "task_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_tasks_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurrence_parent_id_tasks_id_fk" FOREIGN KEY ("recurrence_parent_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_context_tag_id_context_tags_id_fk" FOREIGN KEY ("context_tag_id") REFERENCES "public"."context_tags"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_energy_profile" ADD CONSTRAINT "user_energy_profile_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accounts_user" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_accounts_provider" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_user" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_hash" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_snapshot_user_date" ON "behavior_snapshots" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_snapshot_user" ON "behavior_snapshots" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_tags_user" ON "context_tags" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tags_system" ON "context_tags" USING btree ("system_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_checkin_slot" ON "energy_checkins" USING btree ("user_id","date","slot");--> statement-breakpoint
CREATE INDEX "idx_checkin_user" ON "energy_checkins" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_energy_user" ON "energy_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_folders_user" ON "folders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_folders_parent" ON "folders" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_user" ON "inventory_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_oauth_access_client" ON "oauth_access_tokens" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_oauth_access_session" ON "oauth_access_tokens" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_oauth_access_user" ON "oauth_access_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_oauth_access_refresh" ON "oauth_access_tokens" USING btree ("refresh_id");--> statement-breakpoint
CREATE INDEX "idx_oauth_clients_user" ON "oauth_clients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_oauth_consents_client" ON "oauth_consents" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_oauth_consents_user" ON "oauth_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_oauth_refresh_client" ON "oauth_refresh_tokens" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_oauth_refresh_session" ON "oauth_refresh_tokens" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_oauth_refresh_user" ON "oauth_refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_page_tags_page" ON "page_tags" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "idx_page_tags_tag" ON "page_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_pages_user" ON "pages" USING btree ("user_id") WHERE "pages"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pages_folder" ON "pages" USING btree ("folder_id") WHERE "pages"."folder_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_pages_system" ON "pages" USING btree ("system_id") WHERE "pages"."system_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_pages_parent" ON "pages" USING btree ("parent_page_id") WHERE "pages"."parent_page_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_push_user" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_quests_user" ON "quests" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "idx_sessions_token" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sprints_system" ON "sprints" USING btree ("system_id","status");--> statement-breakpoint
CREATE INDEX "idx_sprints_user" ON "sprints" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sticky_user" ON "sticky_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sticky_page" ON "sticky_notes" USING btree ("page_id") WHERE "sticky_notes"."page_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_sticky_folder" ON "sticky_notes" USING btree ("folder_id") WHERE "sticky_notes"."folder_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sync_user_provider" ON "sync_connections" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_system_health_day" ON "system_health" USING btree ("system_id","date");--> statement-breakpoint
CREATE INDEX "idx_health_user" ON "system_health" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_system_status" ON "system_status_definitions" USING btree ("system_type","status_name");--> statement-breakpoint
CREATE INDEX "idx_system_status_type" ON "system_status_definitions" USING btree ("system_type");--> statement-breakpoint
CREATE UNIQUE INDEX "one_inbox_per_user" ON "systems" USING btree ("user_id") WHERE "systems"."is_inbox" = true;--> statement-breakpoint
CREATE INDEX "idx_systems_user" ON "systems" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_systems_sort" ON "systems" USING btree ("user_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_task_page_links_task" ON "task_page_links" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_page_links_page" ON "task_page_links" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "idx_task_reminders_pending" ON "task_reminders" USING btree ("remind_at") WHERE "task_reminders"."sent_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_task_reminders_task" ON "task_reminders" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_reminders_user" ON "task_reminders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_user_status" ON "tasks" USING btree ("user_id","status") WHERE "tasks"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_tasks_system" ON "tasks" USING btree ("system_id","status") WHERE "tasks"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_tasks_due" ON "tasks" USING btree ("user_id","due_date") WHERE "tasks"."deleted_at" IS NULL AND "tasks"."due_date" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_tasks_recurring" ON "tasks" USING btree ("user_id") WHERE "tasks"."recurrence_rule" IS NOT NULL AND "tasks"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_tasks_parent" ON "tasks" USING btree ("parent_task_id") WHERE "tasks"."parent_task_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_tasks_folder" ON "tasks" USING btree ("folder_id") WHERE "tasks"."folder_id" IS NOT NULL AND "tasks"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_tasks_board" ON "tasks" USING btree ("system_id","board_status") WHERE "tasks"."board_status" IS NOT NULL AND "tasks"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_tasks_sprint" ON "tasks" USING btree ("sprint_id") WHERE "tasks"."sprint_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tasks_external" ON "tasks" USING btree ("external_source","external_id") WHERE "tasks"."external_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_timelogs_user" ON "time_logs" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_timelogs_system" ON "time_logs" USING btree ("system_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_users_provider" ON "users" USING btree ("provider","provider_id") WHERE "users"."provider_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_verifications_identifier" ON "verifications" USING btree ("identifier");