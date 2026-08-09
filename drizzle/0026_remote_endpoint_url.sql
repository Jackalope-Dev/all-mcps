-- Optional secondary connection method: a hosted MCP endpoint offered
-- alongside the primary stdio/remote install already on the listing. Lets a
-- listing advertise both (e.g. a stdio bridge package + the real hosted
-- endpoint it proxies to) and lets the health cron prefer a live tools/list
-- handshake against it over README-parsed guesses.
ALTER TABLE `servers` ADD `remote_endpoint_url` text;
