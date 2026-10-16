-- Trigram FTS5 index for catalog search (lib/servers.ts prefilterSearchCandidates).
-- Replaces the full-table LIKE '%term%' scan over 13 concatenated columns, which
-- read every servable row (raw tools JSON included) on each uncached search.
--
-- Safe to apply directly with
--   wrangler d1 execute all-mcps --remote --file=drizzle/0065_search_fts.sql
-- (every statement is IF NOT EXISTS). It indexes nothing by itself: existing rows
-- are filled by scripts/backfill-search-fts.ts, which then sets the
-- job_cursors 'search_fts_ready' row. Until that row exists, search keeps using
-- the LIKE scan.
--
-- rowid = servers.rowid (fast trigger deletes); `id` is stored too so the search
-- join checks both, and a stale or renumbered rowid can never return a wrong row.
-- `body` holds what the JS scorer reads beyond name/category/description: AI prose
-- clipped to 600 chars each (the scorer never sees past that), the JSON-array
-- columns, and tool *names* only (raw tool schemas are most of the catalog's bytes
-- and the scorer never reads them).
CREATE VIRTUAL TABLE IF NOT EXISTS `servers_fts` USING fts5(
	id UNINDEXED,
	name,
	category,
	description,
	body,
	tokenize = 'trigram'
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `servers_fts_ai` AFTER INSERT ON `servers` BEGIN
	DELETE FROM servers_fts WHERE rowid = new.rowid;
	INSERT INTO servers_fts (rowid, id, name, category, description, body) VALUES (
		new.rowid, new.id, new.name, new.category, new.description,
		coalesce(substr(new.ai_summary, 1, 600), '') || ' ' ||
		coalesce(substr(new.ai_overview, 1, 600), '') || ' ' ||
		coalesce(new.ai_use_cases, '') || ' ' ||
		coalesce(new.ai_features, '') || ' ' ||
		coalesce(new.tags, '') || ' ' ||
		coalesce(new.license, '') || ' ' ||
		coalesce(new.pricing_model, '') || ' ' ||
		coalesce(new.auth_type, '') || ' ' ||
		coalesce(new.compatible_clients, '') || ' ' ||
		coalesce(CASE WHEN json_valid(new.tools) THEN (
			SELECT group_concat(json_extract(je.value, '$.name'), ' ') FROM json_each(new.tools) AS je
		) END, '')
	);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `servers_fts_ad` AFTER DELETE ON `servers` BEGIN
	DELETE FROM servers_fts WHERE rowid = old.rowid;
END;
--> statement-breakpoint
-- Only the indexed columns, and only on a real change: the health, views and
-- tools-check crons update other columns (or rewrite `tools` unchanged) every
-- few minutes, and none of that should rewrite the index row.
CREATE TRIGGER IF NOT EXISTS `servers_fts_au` AFTER UPDATE OF
	id, name, category, description, ai_summary, ai_overview, ai_use_cases, ai_features,
	tags, license, pricing_model, auth_type, compatible_clients, tools
ON `servers`
WHEN old.id IS NOT new.id OR old.name IS NOT new.name OR old.category IS NOT new.category
	OR old.description IS NOT new.description OR old.ai_summary IS NOT new.ai_summary
	OR old.ai_overview IS NOT new.ai_overview OR old.ai_use_cases IS NOT new.ai_use_cases
	OR old.ai_features IS NOT new.ai_features OR old.tags IS NOT new.tags
	OR old.license IS NOT new.license OR old.pricing_model IS NOT new.pricing_model
	OR old.auth_type IS NOT new.auth_type OR old.compatible_clients IS NOT new.compatible_clients
	OR old.tools IS NOT new.tools
BEGIN
	DELETE FROM servers_fts WHERE rowid = old.rowid;
	INSERT INTO servers_fts (rowid, id, name, category, description, body) VALUES (
		new.rowid, new.id, new.name, new.category, new.description,
		coalesce(substr(new.ai_summary, 1, 600), '') || ' ' ||
		coalesce(substr(new.ai_overview, 1, 600), '') || ' ' ||
		coalesce(new.ai_use_cases, '') || ' ' ||
		coalesce(new.ai_features, '') || ' ' ||
		coalesce(new.tags, '') || ' ' ||
		coalesce(new.license, '') || ' ' ||
		coalesce(new.pricing_model, '') || ' ' ||
		coalesce(new.auth_type, '') || ' ' ||
		coalesce(new.compatible_clients, '') || ' ' ||
		coalesce(CASE WHEN json_valid(new.tools) THEN (
			SELECT group_concat(json_extract(je.value, '$.name'), ' ') FROM json_each(new.tools) AS je
		) END, '')
	);
END;
