-- Acquisition attribution: one row per submission / paid upgrade / paid ad with
-- the referrer, UTM tags and landing page that visitor arrived on (see
-- lib/attribution.ts). Read by the admin Acquisition tab and the LopeBase adapter.
CREATE TABLE `conversions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`server_id` text,
	`ad_id` text,
	`sku` text,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`channel` text DEFAULT 'unknown' NOT NULL,
	`ref_host` text,
	`utm_source` text,
	`utm_medium` text,
	`utm_campaign` text,
	`landing_path` text,
	`first_seen_at` integer,
	`heard_from` text,
	`stripe_session_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_conversions_created` ON `conversions` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_conversions_kind_created` ON `conversions` (`kind`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_conversions_server` ON `conversions` (`server_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_conversions_stripe_session` ON `conversions` (`stripe_session_id`);