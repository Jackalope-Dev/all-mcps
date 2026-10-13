CREATE TABLE `listing_signals` (
	`server_id` text PRIMARY KEY NOT NULL,
	`mcp_probability` real,
	`listing_quality` real,
	`triage_verdict` text,
	`triage_reason` text,
	`reviewed_at` integer,
	`curator_kept_at` integer,
	`stale_reasons` text,
	`stale_checked_at` integer,
	`package_deprecated` text,
	`package_missing_at` integer,
	`registry_checked_at` integer,
	`repo_fork_of` text,
	`security_profile` text,
	`tools_changed_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_listing_signals_stale_checked` ON `listing_signals` (`stale_checked_at`);--> statement-breakpoint
CREATE INDEX `idx_listing_signals_registry_checked` ON `listing_signals` (`registry_checked_at`);--> statement-breakpoint
CREATE INDEX `idx_listing_signals_triage` ON `listing_signals` (`triage_verdict`);--> statement-breakpoint
ALTER TABLE `servers` ADD `stale_flagged_at` integer;--> statement-breakpoint
ALTER TABLE `stdio_verifications` ADD `stderr` text;--> statement-breakpoint
ALTER TABLE `stdio_verifications` ADD `install_ms` integer;