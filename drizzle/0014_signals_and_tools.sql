-- Popularity signals + introspected tool list for each listing.
-- github_stars / npm_downloads are refreshed by the health cron; tools is a
-- JSON array of {name, description} captured when a listing exposes a callable
-- MCP endpoint (see app/api/cron/health). All are nullable — absence means
-- "not measured yet", not zero.
ALTER TABLE `servers` ADD `github_stars` integer;
ALTER TABLE `servers` ADD `npm_downloads` integer;
ALTER TABLE `servers` ADD `tools` text;
ALTER TABLE `servers` ADD `tools_checked_at` integer;
