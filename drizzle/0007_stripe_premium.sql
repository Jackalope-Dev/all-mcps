ALTER TABLE `servers` ADD `owner_user_id` text;--> statement-breakpoint
ALTER TABLE `servers` ADD `featured_until` integer;--> statement-breakpoint
ALTER TABLE `servers` ADD `review_priority` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `servers` ADD `stripe_customer_id` text;--> statement-breakpoint
ALTER TABLE `servers` ADD `stripe_subscription_id` text;--> statement-breakpoint
ALTER TABLE `servers` ADD `premium_status` text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `servers` ADD `pending_revision` text;
