-- Bounded per-listing health-check history. Trimmed to the most recent N rows
-- per server_id by /api/cron/health right after each insert, so this table
-- stays flat-sized rather than growing with total checks performed. See
-- app/mcp/[id]/page.tsx for the dot-strip UI this feeds.
CREATE TABLE `server_health_checks` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `server_id` text NOT NULL,
  `checked_at` integer NOT NULL,
  `healthy` integer NOT NULL,
  `detail` text
);
--> statement-breakpoint
CREATE INDEX `idx_health_checks_server` ON `server_health_checks` (`server_id`);
--> statement-breakpoint
CREATE INDEX `idx_health_checks_checked` ON `server_health_checks` (`checked_at`);
