ALTER TABLE `servers` ADD `last_checked_at` integer;--> statement-breakpoint
ALTER TABLE `servers` ADD `is_verified_active` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `servers` ADD `health_status` text DEFAULT 'unknown' NOT NULL;