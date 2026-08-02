-- Cached install hints extracted from READMEs / descriptions by the health cron.
-- install_kind: stdio | remote | unknown
-- install_command: e.g. npx, uvx, or empty for remote
-- install_args: JSON array of args strings, or empty for remote
-- install_package: package/url key used for display
-- install_confidence: high | medium | low
ALTER TABLE `servers` ADD `install_kind` text;
ALTER TABLE `servers` ADD `install_command` text;
ALTER TABLE `servers` ADD `install_args` text;
ALTER TABLE `servers` ADD `install_package` text;
ALTER TABLE `servers` ADD `install_confidence` text;
