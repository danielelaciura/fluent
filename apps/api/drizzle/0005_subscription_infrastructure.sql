-- Phase A: Subscription & Usage Infrastructure
-- Creates plans, subscriptions, usage_records tables
-- Migrates existing users to free subscription
-- Drops subscription_tier column from users

CREATE TYPE "public"."subscription_status" AS ENUM('active', 'canceled', 'past_due');--> statement-breakpoint
CREATE TYPE "public"."period_type" AS ENUM('weekly', 'monthly');--> statement-breakpoint

-- Plans table
CREATE TABLE "plans" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"max_seconds_per_period" integer NOT NULL,
	"period_type" "period_type" NOT NULL,
	"analysis_provider" varchar(50) NOT NULL,
	"stt_provider" varchar(50) NOT NULL,
	"price_cents" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Seed plans
INSERT INTO "plans" ("id", "name", "max_seconds_per_period", "period_type", "analysis_provider", "stt_provider", "price_cents", "is_active")
VALUES
	('free', 'Free', 7200, 'weekly', 'anthropic', 'openai', 0, true),
	('pro', 'Pro', 180000, 'monthly', 'anthropic', 'openai', 1499, true),
	('team', 'Team', 180000, 'monthly', 'anthropic', 'openai', 1299, true);--> statement-breakpoint

-- Subscriptions table
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL UNIQUE,
	"plan_id" varchar(50) NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"stripe_subscription_id" varchar(255),
	"stripe_customer_id" varchar(255),
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action
);--> statement-breakpoint

-- Usage records table
CREATE TABLE "usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"duration_seconds" integer NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "usage_records_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action
);--> statement-breakpoint

-- Migrate existing users to free subscription
INSERT INTO "subscriptions" ("user_id", "plan_id", "status", "current_period_start", "current_period_end")
SELECT "id", 'free', 'active', now(), now() + interval '7 days'
FROM "users";--> statement-breakpoint

-- Drop subscription_tier column and enum
ALTER TABLE "users" DROP COLUMN "subscription_tier";--> statement-breakpoint
DROP TYPE "public"."subscription_tier";
