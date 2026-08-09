-- Tracks live health/uptime of remote_endpoint_url specifically, separate from
-- health_status/is_verified_active (which track the primary url — for a listing
-- with both a repo url and a hosted endpoint, those are different things and
-- conflating them would let a transient endpoint outage trip repo-archival
-- unpublish logic). See app/api/cron/health and lib/qualityScore.ts.
ALTER TABLE `servers` ADD `remote_endpoint_healthy` integer;
--> statement-breakpoint
ALTER TABLE `servers` ADD `remote_endpoint_checked_at` integer;
