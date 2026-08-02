CREATE TABLE `social_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guid` text NOT NULL,
	`channel` text DEFAULT 'twitter' NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`server_id` text,
	`tweet_text` text NOT NULL,
	`source` text,
	`dedupe_key` text,
	`created_at` integer NOT NULL,
	`sent_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_posts_guid_unique` ON `social_posts` (`guid`);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_posts_dedupe_key_unique` ON `social_posts` (`dedupe_key`);
--> statement-breakpoint
CREATE INDEX `idx_social_posts_created` ON `social_posts` (`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_social_posts_status_created` ON `social_posts` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_social_posts_server` ON `social_posts` (`server_id`);
