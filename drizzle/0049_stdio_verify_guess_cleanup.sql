-- Graduates the stdio verification pilot into permanent infrastructure, and
-- teaches it to clean up heuristic install guesses.
--
-- Hand-written rather than drizzle-kit generated on purpose: the drizzle
-- journal stops at 0033 while the applied schema is at 0048 (later migrations
-- were written by hand and applied through wrangler), so `db:generate` diffs
-- against a stale snapshot and emits CREATE TABLE for a dozen tables that
-- already exist. Follow the 0034+ convention here instead.
--
-- 1. Drop "pilot" from the name. The E2B sandbox check has graduated (see
--    app/api/cron/stdio-verify/result) and is staying, so the table should
--    stop describing itself as a trial. Indexes are recreated rather than left
--    carrying the old name; the unique index on server_id is load-bearing —
--    it is what makes /batch's claim-by-insert atomic against concurrent
--    workers — so it is recreated immediately.
ALTER TABLE `stdio_verification_pilot` RENAME TO `stdio_verifications`;
DROP INDEX IF EXISTS `stdio_verification_pilot_server_id_unique`;
CREATE UNIQUE INDEX `stdio_verifications_server_id_unique` ON `stdio_verifications` (`server_id`);
DROP INDEX IF EXISTS `idx_stdio_pilot_server`;
DROP INDEX IF EXISTS `idx_stdio_pilot_checked`;
CREATE INDEX `idx_stdio_verify_server` ON `stdio_verifications` (`server_id`);
CREATE INDEX `idx_stdio_verify_checked` ON `stdio_verifications` (`checked_at`);

-- 2. Consecutive install_failed counter. One failure is not evidence a guessed
--    install command is wrong — a registry outage, a rate limit or a private
--    package all produce it. Two failures across separate runs is. Reset to 0
--    by any other outcome.
ALTER TABLE `stdio_verifications` ADD `install_failures` integer DEFAULT 0 NOT NULL;

-- 3. The package as actually handed to the sandbox. The AI install validator
--    rewrites and nulls these guesses on its own schedule, so a slow sandbox
--    run can return a verdict about a value the listing no longer holds
--    (previously measured at 80% of one batch). Recording what was tested lets
--    the result endpoint drop those instead of acting on them.
ALTER TABLE `stdio_verifications` ADD `tested_package` text;

-- 4. Installed cleanly but never completed the MCP handshake — i.e. the
--    install command is right and the server needs configuration (API keys, a
--    path argument) a bare sandbox cannot supply. Recorded as a positive
--    signal about the install command so a handshake failure is never read as
--    a bad install and never clears install hints.
ALTER TABLE `servers` ADD `install_needs_config` integer;
