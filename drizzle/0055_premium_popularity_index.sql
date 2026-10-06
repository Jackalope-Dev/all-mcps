-- Widen idx_servers_status_premium (0054) to cover the homepage pool too:
-- getActiveServersLight(200) orders active listings by is_premium DESC, views, copies, upvotes
-- and read/sorted ~54k rows per render. Created before the drop so the premium lookup
-- always has an index.
CREATE INDEX `idx_servers_status_premium_popularity` ON `servers` (`status`,`is_premium`,`views`,`copies`,`upvotes`);--> statement-breakpoint
DROP INDEX `idx_servers_status_premium`;