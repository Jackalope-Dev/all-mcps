-- Track when a listing's tweet was *confirmed* sent (not just queued), so
-- owner-facing "highlighted on X" copy and future engagement-based selection
-- can rely on an honest signal instead of enqueue-time lastTweetedAt.
ALTER TABLE `servers` ADD `last_featured_at` integer;
