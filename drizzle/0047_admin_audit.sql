-- Back-office admin adapter (ADR 0006, jackalope-digital-hub).
-- Additive: a new table only, no changes to existing tables. Every mutation the
-- back office makes through /api/backoffice/* writes one row here.
CREATE TABLE IF NOT EXISTS `admin_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`connector_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`request_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`before` text,
	`after` text,
	`created_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_admin_audit_created` ON `admin_audit` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_admin_audit_target` ON `admin_audit` (`target_type`,`target_id`);
