-- Split "Verified owner" from vendor "Official".
--
-- Until now an approved ownership claim set `is_official`, so anyone who proved
-- control of a repo got the same "Official" badge as a server the vendor
-- itself publishes. From here on:
--   owner_verified = an approved ownership claim (who controls the listing)
--   is_official    = published by the product's own company, set only by an
--                    admin with evidence (official_source, official_evidence_url,
--                    official_reviewed_at). 'reference' marks the
--                    modelcontextprotocol reference servers.
--
-- Data migration (every changed row gets an admin_audit entry with
-- request_id '0072_official_owner_split', so it is logged and reversible):
--   1. Claim-derived official rows (is_official = 1 with an owner) become
--      owner_verified = 1, is_official = 0. Reference servers are excluded.
--   2. modelcontextprotocol reference servers keep is_official with
--      official_source = 'reference' and their repo URL as evidence.
--   Official rows with no owner and no reference URL were bulk-granted by an
--   admin, not claimed; they are left as they are (official_source NULL) for
--   the evidence backfill to review.
--
-- To reverse:
--   UPDATE servers SET is_official = 1, owner_verified = 0 WHERE id IN
--     (SELECT target_id FROM admin_audit WHERE request_id = '0072_official_owner_split' AND action = 'split_official_owner');
--   UPDATE servers SET official_source = NULL, official_evidence_url = NULL WHERE id IN
--     (SELECT target_id FROM admin_audit WHERE request_id = '0072_official_owner_split' AND action = 'tag_reference_official');
--   then drop the four columns and delete this file's d1_migrations row.
ALTER TABLE `servers` ADD `owner_verified` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `servers` ADD `official_source` text;--> statement-breakpoint
ALTER TABLE `servers` ADD `official_evidence_url` text;--> statement-breakpoint
ALTER TABLE `servers` ADD `official_reviewed_at` integer;--> statement-breakpoint
INSERT INTO `admin_audit` (`id`, `connector_id`, `actor_id`, `request_id`, `action`, `target_type`, `target_id`, `before`, `after`, `created_at`)
SELECT 'm0072-owner-' || `id`, 'migration', 'migration:0072_official_owner_split', '0072_official_owner_split', 'split_official_owner', 'server', `id`,
  json_object('is_official', `is_official`, 'owner_verified', `owner_verified`),
  json_object('is_official', 0, 'owner_verified', 1),
  CAST(strftime('%s', 'now') AS integer)
FROM `servers`
WHERE `is_official` = 1
  AND `owner_user_id` IS NOT NULL
  AND `url` NOT LIKE 'https://github.com/modelcontextprotocol/servers/%'
  AND `url` NOT LIKE 'https://github.com/modelcontextprotocol/servers-archived/%';--> statement-breakpoint
UPDATE `servers` SET `owner_verified` = 1, `is_official` = 0
WHERE `id` IN (SELECT `target_id` FROM `admin_audit` WHERE `request_id` = '0072_official_owner_split' AND `action` = 'split_official_owner');--> statement-breakpoint
INSERT INTO `admin_audit` (`id`, `connector_id`, `actor_id`, `request_id`, `action`, `target_type`, `target_id`, `before`, `after`, `created_at`)
SELECT 'm0072-ref-' || `id`, 'migration', 'migration:0072_official_owner_split', '0072_official_owner_split', 'tag_reference_official', 'server', `id`,
  json_object('is_official', `is_official`, 'official_source', `official_source`),
  json_object('is_official', 1, 'official_source', 'reference', 'official_evidence_url', `url`),
  CAST(strftime('%s', 'now') AS integer)
FROM `servers`
WHERE `is_official` = 1
  AND (`url` LIKE 'https://github.com/modelcontextprotocol/servers/%'
    OR `url` LIKE 'https://github.com/modelcontextprotocol/servers-archived/%');--> statement-breakpoint
UPDATE `servers` SET `official_source` = 'reference', `official_evidence_url` = `url`
WHERE `id` IN (SELECT `target_id` FROM `admin_audit` WHERE `request_id` = '0072_official_owner_split' AND `action` = 'tag_reference_official');
