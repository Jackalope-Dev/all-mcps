-- Per-listing FAQ content (see /api/cron/ai-faq and /api/cron/ai-content). Real,
-- listing-specific Q&A pairs that replace the generic 3-question FAQ boilerplate
-- on /mcp/[id]. ai_faq_at is a separate claim marker from ai_enriched_at so the
-- already-enriched backlog can be backfilled independently, without re-running
-- (or re-touching) the rest of the AI content pipeline.
ALTER TABLE `servers` ADD `ai_faq` text;
ALTER TABLE `servers` ADD `ai_faq_at` integer;
