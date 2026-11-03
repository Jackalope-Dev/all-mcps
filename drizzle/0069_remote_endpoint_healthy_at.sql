-- Last successful remote-endpoint handshake. remote_endpoint_healthy flips to
-- false on one bad answer; listing indexability reads this instead, so a
-- server seen working in the last 14 days stays indexable through a blip.
ALTER TABLE `servers` ADD `remote_endpoint_healthy_at` integer;--> statement-breakpoint
-- Backfill from the check history (declared endpoints) ...
UPDATE `servers` SET `remote_endpoint_healthy_at` = (
  SELECT max(h.`checked_at`) FROM `server_health_checks` h
  WHERE h.`server_id` = `servers`.`id` AND h.`remote_healthy` = 1
) WHERE `id` IN (
  SELECT `server_id` FROM `server_health_checks` WHERE `remote_healthy` = 1
);--> statement-breakpoint
-- ... and from the current reading (also covers cached remote installs).
UPDATE `servers` SET `remote_endpoint_healthy_at` = max(
  coalesce(`remote_endpoint_healthy_at`, 0), `remote_endpoint_checked_at`
) WHERE `remote_endpoint_healthy` = 1 AND `remote_endpoint_checked_at` IS NOT NULL;
