-- GitHub repo `pushed_at` (last commit/push), captured for free from the same
-- repo API call the health cron already makes for stargazer counts. Surfaced
-- on listing pages/cards so staleness is visible without cloning the repo.
ALTER TABLE `servers` ADD `last_commit_at` integer;
