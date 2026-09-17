-- Migration: track abandoned sponsor-checkout reminder sends
ALTER TABLE `sponsor_ads` ADD COLUMN `abandoned_reminder_sent_at` integer;
