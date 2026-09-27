-- D1 performance composite indexes:
-- 1. idx_servers_status_last_checked: avoids full-table scan on 15-min health cron and enrich cron
-- 2. idx_servers_status_ai_enriched: avoids full-table scan on 20-min ai-content cron
-- 3. idx_impression_server_created: speeds up owner dashboard impression queries by server and date
-- 4. idx_access_server_created: speeds up owner dashboard access queries by server and date
-- 5. idx_access_created_caller: speeds up /trust and getSiteStats caller breakdown queries
CREATE INDEX `idx_servers_status_last_checked` ON `servers` (`status`,`last_checked_at`);--> statement-breakpoint
CREATE INDEX `idx_servers_status_ai_enriched` ON `servers` (`status`,`ai_enriched_at`);--> statement-breakpoint
CREATE INDEX `idx_impression_server_created` ON `impression_logs` (`server_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_access_server_created` ON `api_access_logs` (`server_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_access_created_caller` ON `api_access_logs` (`created_at`,`caller_class`);
