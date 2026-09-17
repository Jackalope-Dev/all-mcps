-- Migration: Universal Sponsor Ad Space & Logs
CREATE TABLE IF NOT EXISTS `sponsor_ads` (
  `id` text PRIMARY KEY NOT NULL,
  `advertiser_email` text NOT NULL,
  `title` text NOT NULL,
  `description` text NOT NULL,
  `cta_text` text NOT NULL DEFAULT 'Learn More',
  `target_url` text NOT NULL,
  `logo_url` text NOT NULL,
  `placement` text NOT NULL DEFAULT 'all',
  `bid_cpm` integer NOT NULL DEFAULT 500,
  `total_impressions_purchased` integer NOT NULL DEFAULT 1000,
  `impressions_served` integer NOT NULL DEFAULT 0,
  `clicks_count` integer NOT NULL DEFAULT 0,
  `status` text NOT NULL DEFAULT 'pending_approval',
  `rejection_reason` text,
  `stripe_session_id` text,
  `stripe_payment_intent_id` text,
  `amount_paid_cents` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL,
  `approved_at` integer,
  `completed_at` integer
);

CREATE INDEX IF NOT EXISTS `idx_sponsor_ads_status` ON `sponsor_ads` (`status`);
CREATE INDEX IF NOT EXISTS `idx_sponsor_ads_placement_status` ON `sponsor_ads` (`placement`, `status`);
CREATE INDEX IF NOT EXISTS `idx_sponsor_ads_email` ON `sponsor_ads` (`advertiser_email`);
CREATE INDEX IF NOT EXISTS `idx_sponsor_ads_created` ON `sponsor_ads` (`created_at`);

CREATE TABLE IF NOT EXISTS `sponsor_ad_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `ad_id` text NOT NULL REFERENCES `sponsor_ads`(`id`) ON DELETE CASCADE,
  `event_type` text NOT NULL,
  `placement` text NOT NULL,
  `session_hash` text,
  `created_at` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `idx_ad_logs_ad` ON `sponsor_ad_logs` (`ad_id`);
CREATE INDEX IF NOT EXISTS `idx_ad_logs_event` ON `sponsor_ad_logs` (`event_type`);
CREATE INDEX IF NOT EXISTS `idx_ad_logs_created` ON `sponsor_ad_logs` (`created_at`);
