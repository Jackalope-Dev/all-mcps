# Blog SEO/AEO overhaul — design

## Goal

Turn the current single-file, hardcoded blog page into a small markdown-file-driven blog subsystem with real per-post URLs, JSON-LD, an RSS feed, tag/search UI, and a rewritten long-form first post. Set up a lightweight, agent-friendly convention (documented in `AGENTS.md`) so future posts are just an `.md` file drop plus a rebuild/deploy — no code changes.

## Non-goals

- No CMS, no admin UI for authoring posts.
- No full-text/server-side search — client-side filtering is enough at this post count.
- No comments, no pagination (revisit if post count grows past ~30-40).
- No build-step/codegen beyond what `next build` already does.

## Content model

**Location:** `content/blog/YYYY-MM-DD-slug.md` — one file per post. The filename is the source of truth for date and slug (`slug` = filename with the date prefix and `.md` stripped).

**Frontmatter (YAML, parsed via `gray-matter`):**

```yaml
---
title: "Post title"
excerpt: "One-sentence summary used in cards, meta description, and RSS."
tags: ["MCP", "Announcements"]
faq: # optional — omit if not applicable
  - q: "Question text?"
    a: "Answer text."
---
```

`date` is not a frontmatter field — it's derived from the filename prefix to avoid drift between filename and metadata.

**`lib/blog.ts`** (new, server-only module):

- `getAllPosts()`: reads `content/blog/`, parses each file with `gray-matter`, computes `slug`, `date` (from filename), `readingTime` (word count / 200, rounded up), returns posts sorted newest-first. Throws away nothing — no draft/publish flag needed at this scale (a post you don't want live yet, you don't push).
- `getPostBySlug(slug)`: finds one post, returns `{ ...frontmatter, slug, date, readingTime, content }` where `content` is the raw markdown body for `SafeMarkdown`.
- `getAllTags()`: derives the distinct sorted tag list from all posts.

All three are plain functions using Node's `fs`/`path`. They are only ever invoked from statically-generated routes (see below), so `fs` executes during `next build`, never inside the deployed Worker.

## Routes

### `app/blog/page.tsx` (listing)

- Server component: calls `getAllPosts()`, passes the array to a new client component `components/BlogListClient.tsx`.
- `BlogListClient` renders a search input and a row of tag chips (derived from the passed-in posts), filters client-side (substring match against title/excerpt/tags; tag chips are additive toggle filters), and renders cards (`surface` class, consistent with existing `article` cards) linking to `/blog/[slug]`.
- Page-level JSON-LD: `Blog` type with `blogPost` set to a lightweight `BlogPosting` stub per post (headline, url, datePublished) plus a `BreadcrumbList` (Home > Blog).
- `<link rel="alternate" type="application/rss+xml">` added via the `alternates.types` field in `generateMetadata`/`export const metadata`.
- `export const dynamic = 'force-static'`.

### `app/blog/[slug]/page.tsx` (post)

- `generateStaticParams()` returns all slugs from `getAllPosts()`. `export const dynamicParams = false` — unknown slugs 404 instead of attempting on-demand render (which would require runtime `fs`).
- `generateMetadata()`: title, description (=`excerpt`), canonical `https://allmcps.com/blog/[slug]`, OpenGraph (`type: 'article'`, `publishedTime`), Twitter card.
- Body renders: breadcrumb nav (Home > Blog > Post title, matching the pattern in `mcp/[id]/page.tsx`), title, date + reading time meta line, tag chips, a table of contents auto-built by scanning the markdown for `## ` headings (simple regex, renders anchor links; headings get matching `id` attributes via a small `remark`/`rehype` slug step or a `components` override on `SafeMarkdown`'s `h2`/`h3`), the post body via `SafeMarkdown`, and — if `faq` frontmatter is present — a rendered FAQ section at the bottom.
- JSON-LD `@graph`: `BlogPosting` (headline, description, datePublished, author: `{"@type":"Organization","name":"AllMCPs","url":"https://allmcps.com"}`, publisher: same organization + logo, keywords: tags.join(', '), mainEntityOfPage), `BreadcrumbList`, and `FAQPage` (only when `faq` is present) — same `@graph` array pattern already used in `app/mcp/[id]/page.tsx`.

### `app/blog/rss.xml/route.ts` (new)

- `export const dynamic = 'force-static'`.
- Builds RSS 2.0 XML by hand (title, link, description=channel description, then one `<item>` per post: title, link, guid=link, pubDate, description=excerpt). No `content:encoded` full-text — excerpt only, matching the "not too sophisticated" brief.

### `app/sitemap.ts` (edit)

- Add a `blog/[slug]` entry per post from `getAllPosts()`, `lastModified` = post date, `changeFrequency: 'monthly'`, `priority: 0.6`. Wrapped in the same try/catch-and-fall-back-to-empty style already used for the D1 lookup in this file, so a failure never breaks the rest of the sitemap.

## Styling

Reuse existing primitives: `page-shell`, `page-shell-inner`, `surface`, `markdown-body`, `text-page-title`, `text-section`, `text-meta`, `breadcrumb`. Tag chips reuse (or lightly extend) the existing `Badge` component. No new design-system classes beyond a small `.blog-tag-filter` / `.blog-search` block in `globals.css` for the listing controls.

## Content: rewritten first post

`content/blog/2026-07-27-launching-allmcps.md` (date kept as-is to preserve the original publish date). Rewritten to ~1800-2500 words, structured with H2s (What is MCP and why discovery is broken → What AllMCPs does → How to evaluate and install a server → Claiming and verifying your own server → What's next), a short TL;DR under the title, an FAQ block (3-4 Qs) driving the `FAQPage` JSON-LD, and internal links to `/what-is-mcp`, `/guide`, `/browse`, `/submit`. Tags: `["MCP", "Announcements"]`.

## Docs for future posts

New `## Blog Posts` section appended to `AGENTS.md`:

- File location and naming convention (`content/blog/YYYY-MM-DD-slug.md`).
- Frontmatter schema with a minimal example.
- Guidance: long-form and educational, ~800+ words minimum, use `##`/`###` headings, one-sentence `excerpt`, 2-5 `tags`, optional `faq` block for FAQPage eligibility.
- Explicit note: tags, search, RSS, sitemap, and JSON-LD are all derived automatically from the file — no other file needs to be touched to publish a post.
- Note that posts go live on the next build/deploy (statically generated), not instantly.

## Testing

- `npm run build` succeeds with the new content and routes (confirms `generateStaticParams`/`force-static` + `fs` at build time works end to end, which is the main technical risk in this design).
- Manual check in dev server: `/blog` lists the post with working search/tag filter, `/blog/launching-allmcps` renders with correct JSON-LD (validate via browser devtools / paste into a schema validator), `/blog/rss.xml` returns valid XML, `/sitemap.xml` includes the post URL.
