-- Captures the remote-endpoint reading alongside the existing primary
-- healthy signal in the same per-check row, so the quality score's "Server
-- availability" component can use a rolling window instead of a single live
-- snapshot. Null when the listing has no remoteEndpointUrl (nothing to
-- record) or on rows predating this migration.
ALTER TABLE `server_health_checks` ADD `remote_healthy` integer;
