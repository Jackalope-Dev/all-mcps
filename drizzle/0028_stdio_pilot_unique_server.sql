-- Enforces one row per listing in the E2B stdio-verification pilot table.
-- The batch endpoint previously relied on a SELECT-then-INSERT sequence to
-- avoid handing the same listing to two overlapping requests, which turned
-- out to have a real race window (confirmed: several listings processed
-- twice in a single run despite in-process guarding — the gap was between
-- separate HTTP requests to the Worker, which only a DB-level constraint can
-- close). Existing duplicates must be removed before this index can be
-- created; see the dedupe DELETE run manually against production before this
-- migration (kept the highest-id row per server_id).
CREATE UNIQUE INDEX `idx_stdio_pilot_server_unique` ON `stdio_verification_pilot` (`server_id`);
