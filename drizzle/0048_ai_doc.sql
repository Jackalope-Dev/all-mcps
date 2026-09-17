-- Long-form restructured writeup for listing pages (see lib/aiContent.ts,
-- app/api/cron/ai-content). Replaces mirroring the raw upstream README on
-- /mcp/[id] (the README moved to the noindex /mcp/[id]/readme route) with
-- original, paraphrased prose under our own headings — kills the duplicate-
-- content problem that was ranking the source repo above our listing pages.
-- ai_doc_at is a separate backfill clock (same pattern as ai_faq_at /
-- install_extracted_at) and feeds the listing's honest content-freshness
-- lastmod in lib/sitemapHelpers.ts. Both nullable — absence means the page
-- falls back to ai_overview + a link to the README route.
ALTER TABLE `servers` ADD `ai_doc` text;
ALTER TABLE `servers` ADD `ai_doc_at` integer;
