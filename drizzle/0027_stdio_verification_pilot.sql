-- Pilot table for E2B-sandboxed stdio server verification. Kept separate from
-- servers.tools/tools_source until the approach is validated — see
-- app/api/cron/stdio-pilot/* and .github/workflows/e2b-stdio-pilot.yml.
CREATE TABLE `stdio_verification_pilot` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `server_id` text NOT NULL,
  `status` text NOT NULL,
  `tool_count` integer,
  `tools` text,
  `error` text,
  `duration_ms` integer,
  `checked_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_stdio_pilot_server` ON `stdio_verification_pilot` (`server_id`);
--> statement-breakpoint
CREATE INDEX `idx_stdio_pilot_checked` ON `stdio_verification_pilot` (`checked_at`);
