-- Track when a listing was last posted to X/Twitter so the highlight cron can
-- rotate through servers (least-recently-posted first) instead of repeating.
ALTER TABLE `servers` ADD `last_tweeted_at` integer;
