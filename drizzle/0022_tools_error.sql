-- Surface *why* MCP tool introspection failed for a listing instead of
-- silently leaving `tools` null with no diagnostic (see app/api/cron/health).
ALTER TABLE `servers` ADD `tools_error` text;
