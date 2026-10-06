-- Hot-query indexes (D1 "overloaded, requests queued for too long", 2026-10-05):
-- 1. idx_servers_status_category_popularity: getRelatedServers on every /mcp/[id] render read and sorted
--    the whole category (~14k rows, ~69ms, ~217k runs/day) - the top query by D1 time.
-- 2/3. idx_servers_status_premium / _featured_until: getFeaturedServers scanned every active listing
--    (~27k rows, ~64k runs/day) to find a handful of premium/featured rows.
CREATE INDEX `idx_servers_status_category_popularity` ON `servers` (`status`,`category`,`views`,`copies`,`upvotes`);--> statement-breakpoint
CREATE INDEX `idx_servers_status_premium` ON `servers` (`status`,`is_premium`);--> statement-breakpoint
CREATE INDEX `idx_servers_status_featured_until` ON `servers` (`status`,`featured_until`);