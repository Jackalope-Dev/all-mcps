-- `status = 'active'` is the base filter on nearly every catalog read (browse,
-- category pages, related/featured lookups, sitemap) and, at 10k+ rows, was an
-- unindexed full table scan on every request. These composite indexes cover the
-- (status + category) and (status + created_at) shapes used by
-- getCategoryServers/getNewestActiveServers so D1 can seek + range-scan instead
-- of scanning the whole table and sorting in memory; the popularity one covers
-- getPopularServers' `ORDER BY views DESC, copies DESC, upvotes DESC`.
CREATE INDEX `idx_servers_status` ON `servers` (`status`);--> statement-breakpoint
CREATE INDEX `idx_servers_status_category` ON `servers` (`status`,`category`);--> statement-breakpoint
CREATE INDEX `idx_servers_status_created` ON `servers` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_servers_status_popularity` ON `servers` (`status`,`views`,`copies`,`upvotes`);
