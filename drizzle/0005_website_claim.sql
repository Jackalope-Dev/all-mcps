ALTER TABLE `servers` ADD `website_url` text;--> statement-breakpoint
ALTER TABLE `servers` ADD `is_premium` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `servers` ADD `website_verified` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `servers` ADD `claimed_at` integer;
