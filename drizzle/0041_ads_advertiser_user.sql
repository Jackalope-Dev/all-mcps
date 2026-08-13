-- Migration: link sponsor ad campaigns to the signed-in account that created them
ALTER TABLE `sponsor_ads` ADD COLUMN `advertiser_user_id` text;
CREATE INDEX IF NOT EXISTS `idx_sponsor_ads_user` ON `sponsor_ads` (`advertiser_user_id`);
