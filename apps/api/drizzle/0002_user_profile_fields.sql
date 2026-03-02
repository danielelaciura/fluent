-- Rename name → first_name (preserves existing data)
ALTER TABLE "users" RENAME COLUMN "name" TO "first_name";--> statement-breakpoint
-- Add last_name and avatar_url
ALTER TABLE "users" ADD COLUMN "last_name" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" varchar(1024);--> statement-breakpoint
-- Split existing full names: everything before first space → first_name (already there),
-- everything after → last_name
UPDATE "users"
SET
  "last_name" = NULLIF(TRIM(SUBSTRING("first_name" FROM POSITION(' ' IN "first_name") + 1)), ''),
  "first_name" = SPLIT_PART("first_name", ' ', 1)
WHERE "first_name" IS NOT NULL AND POSITION(' ' IN "first_name") > 0;
