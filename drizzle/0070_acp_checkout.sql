CREATE TABLE `acp_checkout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_token_hash` text NOT NULL,
	`status` text NOT NULL,
	`items` text NOT NULL,
	`buyer` text,
	`stripe_payment_intent_id` text,
	`amount_paid_cents` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_acp_sessions_agent` ON `acp_checkout_sessions` (`agent_token_hash`);--> statement-breakpoint
CREATE TABLE `acp_idempotency_keys` (
	`agent_token_hash` text NOT NULL,
	`key` text NOT NULL,
	`request_hash` text NOT NULL,
	`response_status` integer,
	`response_body` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`agent_token_hash`, `key`)
);
--> statement-breakpoint
CREATE INDEX `idx_acp_idempotency_created` ON `acp_idempotency_keys` (`created_at`);