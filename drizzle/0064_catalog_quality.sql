CREATE TABLE `search_misses` (
	`query` text PRIMARY KEY NOT NULL,
	`surface` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_search_misses_count` ON `search_misses` (`count`);--> statement-breakpoint
CREATE INDEX `idx_search_misses_last_seen` ON `search_misses` (`last_seen_at`);--> statement-breakpoint
ALTER TABLE `listing_signals` ADD `readme_hash` text;--> statement-breakpoint
ALTER TABLE `listing_signals` ADD `latest_release_tag` text;--> statement-breakpoint
ALTER TABLE `listing_signals` ADD `content_changed_at` integer;--> statement-breakpoint
ALTER TABLE `listing_signals` ADD `discovered_via` text;