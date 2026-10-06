-- Feed paging: getDirectoryFeedPage pages the active catalog by (created_at DESC, id DESC)
-- with OFFSET; without `id` in the index every page re-sorted and walked all earlier rows
-- (~46k rows read for deep pages). Superset of idx_servers_status_created, which it replaces.
-- Created before the drop so newest-first queries always have an index.
CREATE INDEX `idx_servers_status_created_id` ON `servers` (`status`,`created_at`,`id`);--> statement-breakpoint
DROP INDEX `idx_servers_status_created`;