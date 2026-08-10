CREATE TABLE IF NOT EXISTS `agent_registration_codes` (
	`email` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`agent_name` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `agent_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` text NOT NULL,
	`agent_name` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`last_used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `agent_tokens_token_hash_unique` ON `agent_tokens` (`token_hash`);
CREATE INDEX IF NOT EXISTS `idx_agent_tokens_user` ON `agent_tokens` (`user_id`);
