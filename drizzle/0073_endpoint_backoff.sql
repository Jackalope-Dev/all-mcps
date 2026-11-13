ALTER TABLE `listing_signals` ADD `endpoint_failures` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `listing_signals` ADD `endpoint_retry_at` integer;--> statement-breakpoint
ALTER TABLE `listing_signals` ADD `endpoint_blocked_reason` text;--> statement-breakpoint
ALTER TABLE `listing_signals` ADD `endpoint_backoff_url` text;
