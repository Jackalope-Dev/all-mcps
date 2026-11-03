-- Admin reject/unpublish decisions with reason codes and a listing snapshot
-- (lib/moderationReasons.ts). Rejected servers rows are deleted, so this is the
-- only record of what was rejected and why.
CREATE TABLE `moderation_decisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`server_id` text NOT NULL,
	`action` text NOT NULL,
	`reasons` text NOT NULL,
	`note` text,
	`source` text NOT NULL,
	`snapshot` text NOT NULL,
	`gate_decision` text,
	`decided_by` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_moderation_decisions_created` ON `moderation_decisions` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_moderation_decisions_server` ON `moderation_decisions` (`server_id`);