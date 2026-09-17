CREATE TABLE IF NOT EXISTS `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`server_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`comment_status` text DEFAULT 'none' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_reviews_server_user` ON `reviews` (`server_id`,`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_reviews_server` ON `reviews` (`server_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_reviews_comment_status` ON `reviews` (`comment_status`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`server_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text,
	`reporter_ip_hash` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`reviewed_at` integer
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_reports_server` ON `reports` (`server_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_reports_status` ON `reports` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_reports_created` ON `reports` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_reports_ip_created` ON `reports` (`reporter_ip_hash`,`created_at`);
