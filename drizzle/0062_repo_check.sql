ALTER TABLE `listing_signals` ADD `repo_status` text;--> statement-breakpoint
ALTER TABLE `listing_signals` ADD `repo_checked_at` integer;--> statement-breakpoint
ALTER TABLE `listing_signals` ADD `repo_gone_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `listing_signals` ADD `repo_first_gone_at` integer;