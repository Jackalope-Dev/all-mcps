<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Brand & Styling Rules
When working on UI, design, or layout tasks, please refer to the [BRAND_GUIDE.md](./BRAND_GUIDE.md) to ensure consistency with our established colors, typography, and logo assets.

# Sitemap lastmod (static marketing pages)

Crawl signals depend on **honest** `lastmod` values. Static hub/guide pages do **not** use `new Date()` on every request — that taught crawlers to ignore our sitemap.

Ship dates live in [`lib/sitemapHelpers.ts`](./lib/sitemapHelpers.ts) as `STATIC_PAGE_LASTMOD` (path → `YYYY-MM-DD`).

**When you must bump the date (use today's date in `YYYY-MM-DD`):**

- You change meaningful body copy, FAQ answers, or step-by-step instructions on a page listed in `STATIC_PAGE_LASTMOD`.
- You add a **new** static route that should appear in the core sitemap (guides, tools, client pages, trust, pricing, etc.): add a `STATIC_PAGE_LASTMOD` entry **and** a matching `staticEntry(...)` in [`app/sitemap.ts`](./app/sitemap.ts) core shard (if the page is not already generated from blog/categories/listings).
- You rename or retarget a path: remove the old key, add the new one.

**Do not bump for:**

- Pure refactors (imports, formatting, component renames with no user-visible copy change).
- CSS-only / layout-only tweaks that do not change content.
- Blog posts — lastmod comes from the `YYYY-MM-DD` filename prefix automatically.
- MCP listing pages — lastmod comes from `lastCheckedAt` / `createdAt` automatically.

**Also keep in sync when adding a new evergreen guide or hub:**

1. `STATIC_PAGE_LASTMOD` + core sitemap entry (if applicable).
2. [`app/guides/page.tsx`](./app/guides/page.tsx) if it belongs on the Guides hub.
3. Footer / homepage chips / `INDEXNOW_CORE_PATHS` in `lib/sitemapHelpers.ts` for high-priority discovery pages.
4. Optionally [`app/llms.txt/route.ts`](./app/llms.txt/route.ts) under Useful Links.

# Blog Posts

Blog posts live at `content/blog/YYYY-MM-DD-slug.md` — one markdown file per post. The filename's date prefix and slug are the source of truth; there's no separate `date` field in frontmatter.

Frontmatter schema:

```yaml
---
title: "Post title"
excerpt: "One-sentence summary — used in listing cards, the meta description, and the RSS feed."
tags: ["Tag One", "Tag Two"]
faq: # optional — omit if the post has no FAQ section
  - q: "Question?"
    a: "Answer."
---
```

Guidelines:
- Long-form and educational, ~800+ words minimum.
- Structure the body with `##` headings — they auto-build the table of contents. Keep heading text plain (no bold/italic/inline code inside a `##` line) since headings are converted straight to HTML for anchor linking.
- 2-5 tags; tags automatically populate the filter chips and search on `/blog`.
- The `faq` block, if present, renders as a "Frequently asked questions" section on the post and adds `FAQPage` structured data — useful for answer-engine visibility.
- Everything else (tag filters, search, RSS feed, sitemap entry, JSON-LD) is generated automatically from the file. No other file needs to change to publish a post.
- Posts are statically generated, so a new file goes live on the next build/deploy, not instantly — run `npm run build` locally to confirm it compiles before pushing.

# Agent Pre-Handoff Quality Gate

Before completing any task, handing off work to the user, or declaring a change complete, all AI agents MUST run and verify that these checks pass cleanly:

1. `npm run typecheck` — TypeScript verification (`tsc --noEmit`) must exit with 0 errors.
2. `npm run check` or `npm run format` — Ensure staged/modified files conform to Biome formatting and linter rules.
3. `npm test` — Ensure all Vitest unit and regression tests pass.

