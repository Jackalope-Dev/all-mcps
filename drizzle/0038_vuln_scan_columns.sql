-- Supply-chain vulnerability signal: OSV.dev advisory counts by severity for
-- each listing's install package (see lib/vulnScan.ts, /api/cron/vuln-scan).
-- All null until first scanned; the quality score treats null as neutral,
-- never as a negative signal (see lib/qualityScore.ts).
ALTER TABLE `servers` ADD `vuln_ecosystem` text;--> statement-breakpoint
ALTER TABLE `servers` ADD `vuln_critical_count` integer;--> statement-breakpoint
ALTER TABLE `servers` ADD `vuln_high_count` integer;--> statement-breakpoint
ALTER TABLE `servers` ADD `vuln_medium_count` integer;--> statement-breakpoint
ALTER TABLE `servers` ADD `vuln_low_count` integer;--> statement-breakpoint
ALTER TABLE `servers` ADD `vuln_scanned_at` integer;
