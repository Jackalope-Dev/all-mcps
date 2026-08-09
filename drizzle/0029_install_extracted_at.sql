-- Tracks when the LLM last validated/re-extracted install_kind/install_command/
-- install_args/install_package for a listing, separate from ai_enriched_at so
-- the already-enriched backlog can be backfilled for install-field re-checks
-- alone (see lib/aiContent.ts, app/api/cron/ai-content).
ALTER TABLE `servers` ADD `install_extracted_at` integer;
