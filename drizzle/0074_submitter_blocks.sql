CREATE TABLE `submission_ips` (
	`server_id` text PRIMARY KEY NOT NULL,
	`ip_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_submission_ips_ip_hash` ON `submission_ips` (`ip_hash`);--> statement-breakpoint
CREATE TABLE `submitter_blocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`reason` text,
	`source_id` text,
	`created_by` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_submitter_blocks_kind_value` ON `submitter_blocks` (`kind`,`value`);--> statement-breakpoint
ALTER TABLE `sponsor_ads` ADD `advertiser_ip_hash` text;