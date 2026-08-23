-- Split the single `reciprocal_badge_ok` signal into two source-specific
-- columns so the repo README badge and the custom-website backlink are tracked
-- as independent verifications. Previously both checks wrote the same boolean,
-- so on any listing that had both a GitHub repo and a website the health cron's
-- website check would overwrite the README result (or vice versa), and a repo
-- README badge could grant dofollow to an unrelated marketing site.
--
-- `reciprocal_badge_ok` stays as the derived aggregate (readme OR website) that
-- most consumers already read; the new columns feed it and let dofollow policy
-- gate the website link specifically on `website_backlink_ok`.
--
-- Backfill: seed both new columns from the existing aggregate. This is
-- conservative in the grant direction (no listing loses dofollow on deploy);
-- the next health-cron run recomputes each source independently and corrects
-- any listing whose two signals actually differ.
ALTER TABLE `servers` ADD `readme_badge_ok` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `servers` ADD `website_backlink_ok` integer DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE `servers` SET `readme_badge_ok` = 1 WHERE `reciprocal_badge_ok` = 1 AND `url` LIKE '%github.com%';
--> statement-breakpoint
UPDATE `servers` SET `website_backlink_ok` = 1 WHERE `reciprocal_badge_ok` = 1 AND `website_url` IS NOT NULL AND `website_url` != '';
