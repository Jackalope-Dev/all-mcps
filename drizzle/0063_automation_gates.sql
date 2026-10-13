CREATE TABLE `auto_decisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gate` text NOT NULL,
	`server_id` text NOT NULL,
	`decision` text NOT NULL,
	`reason` text NOT NULL,
	`evidence` text,
	`mode` text NOT NULL,
	`acted_at` integer,
	`human_decision` text,
	`human_at` integer,
	`undone_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_auto_decisions_gate_server` ON `auto_decisions` (`gate`,`server_id`);--> statement-breakpoint
CREATE INDEX `idx_auto_decisions_gate_created` ON `auto_decisions` (`gate`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_auto_decisions_server` ON `auto_decisions` (`server_id`);--> statement-breakpoint
CREATE TABLE `automation_gates` (
	`gate` text PRIMARY KEY NOT NULL,
	`mode` text DEFAULT 'shadow' NOT NULL,
	`updated_at` integer,
	`updated_by` text
);
--> statement-breakpoint
ALTER TABLE `listing_signals` ADD `triage_confidence` real;--> statement-breakpoint
ALTER TABLE `listing_signals` ADD `repo_stars` integer;