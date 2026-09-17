-- Distinguishes live-verified tool data (real MCP handshake) from best-effort
-- static parsing of a repo's README, so the UI/consumers never conflate the two
-- (see app/api/cron/health and lib/tools/parseToolsFromReadme).
ALTER TABLE `servers` ADD `tools_source` text;
