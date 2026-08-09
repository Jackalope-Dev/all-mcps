-- Backfills a real gap in this repo's migration history: is_verified_active
-- and health_status have existed on production `servers` since early on, but
-- were apparently added via a raw ALTER TABLE outside drizzle-kit at some
-- point, never captured as a migration file. That meant `wrangler d1
-- migrations apply` could never produce a correct schema for a fresh
-- environment (confirmed: local dev's D1 was missing both columns entirely,
-- causing "no such column" failures wherever they're read). Already present
-- in production — this file exists so migration history is complete and any
-- future fresh environment (including local dev resets) ends up correct.
ALTER TABLE `servers` ADD `is_verified_active` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `servers` ADD `health_status` text DEFAULT 'unknown' NOT NULL;
