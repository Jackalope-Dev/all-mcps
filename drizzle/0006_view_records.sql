CREATE TABLE `view_records` (
	`server_id` text NOT NULL,
	`ip_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`server_id`, `ip_hash`)
);
