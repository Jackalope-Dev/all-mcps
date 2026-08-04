-- LLM-generated content layer for listings (see app/api/cron/ai-content).
-- Turns scraped README-mirror pages into unique, useful content for readers and
-- search. All nullable — absence means the page falls back to the raw
-- description/README. ai_use_cases and ai_features are JSON string arrays.
ALTER TABLE `servers` ADD `ai_summary` text;
ALTER TABLE `servers` ADD `ai_overview` text;
ALTER TABLE `servers` ADD `ai_use_cases` text;
ALTER TABLE `servers` ADD `ai_features` text;
ALTER TABLE `servers` ADD `ai_enriched_at` integer;
