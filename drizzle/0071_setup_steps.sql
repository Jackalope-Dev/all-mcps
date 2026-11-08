ALTER TABLE `servers` ADD `setup_steps` text;--> statement-breakpoint
ALTER TABLE `servers` ADD `setup_note` text;--> statement-breakpoint
ALTER TABLE `servers` ADD `setup_source_url` text;--> statement-breakpoint
ALTER TABLE `servers` ADD `setup_source` text;--> statement-breakpoint
ALTER TABLE `servers` ADD `setup_extracted_at` integer;--> statement-breakpoint
CREATE INDEX `idx_servers_setup_due` ON `servers` (`views`) WHERE status = 'active' AND install_kind IS NULL AND setup_extracted_at IS NULL;