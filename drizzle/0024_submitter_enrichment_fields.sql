-- Submitter-controlled enrichment fields: pricing, auth, license, client
-- compatibility, maintenance status, support link, screenshot, and a
-- suggested-install hint used when auto-detected install_confidence is low.
ALTER TABLE `servers` ADD `tags` text;
ALTER TABLE `servers` ADD `pricing_model` text;
ALTER TABLE `servers` ADD `pricing_notes` text;
ALTER TABLE `servers` ADD `auth_type` text;
ALTER TABLE `servers` ADD `license` text;
ALTER TABLE `servers` ADD `compatible_clients` text;
ALTER TABLE `servers` ADD `maintenance_status` text;
ALTER TABLE `servers` ADD `support_url` text;
ALTER TABLE `servers` ADD `screenshot_url` text;
ALTER TABLE `servers` ADD `pending_screenshot_key` text;
ALTER TABLE `servers` ADD `suggested_install_command` text;
ALTER TABLE `servers` ADD `suggested_install_args` text;
