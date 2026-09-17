ALTER TABLE `servers` ADD `reciprocal_badge_ok` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `servers` ADD `badge_last_checked_at` integer;
