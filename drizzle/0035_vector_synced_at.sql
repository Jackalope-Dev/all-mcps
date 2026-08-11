-- Tracks when each listing's embedding was last pushed to Cloudflare Vectorize
-- (see /api/cron/vector-index). Null = never indexed. Lets the cron claim a
-- bounded batch per tick instead of walking the full catalog every run — the
-- unbounded version blew the Worker scheduled-handler's time/subrequest budget
-- on every single cron tick, taking every other cron job down with it.
ALTER TABLE `servers` ADD `vector_synced_at` integer;
