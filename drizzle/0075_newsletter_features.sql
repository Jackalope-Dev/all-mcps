CREATE TABLE `newsletter_features` (
	`campaign` text NOT NULL,
	`server_id` text NOT NULL,
	`slot` text NOT NULL,
	`featured_at` integer NOT NULL,
	PRIMARY KEY(`campaign`, `server_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_newsletter_features_featured` ON `newsletter_features` (`featured_at`);--> statement-breakpoint
ALTER TABLE `listing_signals` ADD `repo_created_at` integer;