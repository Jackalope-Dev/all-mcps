ALTER TABLE `servers` ADD `logo_checked_at` integer;--> statement-breakpoint
CREATE INDEX `idx_servers_status_logo_checked` ON `servers` (`status`,`logo_checked_at`);