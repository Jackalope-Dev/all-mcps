-- Split listing views into a public count and an internal ranking count.
--   servers.total_views: every non-bot listing page load; what visitors see.
--   servers.views: unchanged column, now one count per hashed IP per listing per
--     24h (view_records.last_counted_at gates it); still feeds ranking/sorts.
-- total_views starts at the existing lifetime-unique count so public numbers
-- don't reset, and existing gate rows count as last counted when first seen.
ALTER TABLE `servers` ADD `total_views` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `view_records` ADD `last_counted_at` integer;--> statement-breakpoint
UPDATE `servers` SET `total_views` = `views`;--> statement-breakpoint
UPDATE `view_records` SET `last_counted_at` = `created_at` WHERE `last_counted_at` IS NULL;
