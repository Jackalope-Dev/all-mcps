# Comprehensive "Build an MCP Server" guide + site-wide SEO/link audit fixes

## Goal

`/build-mcp-server` is AllMCPs' existing page targeting "how to build an MCP server," but it's thin (one 15-line tool example per language, no resources/prompts examples, no deployment guidance, no FAQ). Expand it into a genuinely comprehensive, SEO-optimized reference guide with copyable code blocks, then fix the small set of real gaps found in a full-site SEO/link audit (sitemap, llms.txt, internal cross-linking).

## Why expand `/build-mcp-server` instead of creating a new page/post

- It already targets this exact search intent, already carries `TechArticle` JSON-LD, and already sits in `sitemap.ts` at priority 0.9.
- It already has inbound links from `/guide`'s footer link and `SiteFooter`.
- A second page/post on the same topic risks cannibalizing search intent instead of reinforcing it.

## Part 1 — Content expansion of `/build-mcp-server`

Rewrite `app/build-mcp-server/page.tsx` (still a server component; add one `'use client'` leaf via `CopyBlock` for each code sample) with these sections, each with an `id` anchor already wired into the existing "On this page" nav (nav gets updated to match new section list):

1. **Overview & Core Concepts** — keep, lightly tightened.
2. **Choosing your stack** — new. Short comparison of official SDKs: TypeScript (`@modelcontextprotocol/sdk`), Python (`mcp`/FastMCP), plus one-line mentions + links for Go, Java/Kotlin, C# SDKs (link to https://github.com/modelcontextprotocol org repos). No code here, just guidance + links.
3. **Building with TypeScript** — expand the current calculator-only example into a server that registers:
   - one **tool** (kept: `calculate_sum`)
   - one **resource** (e.g. a static `config://app` resource returning JSON)
   - one **prompt** (e.g. a `summarize` prompt template)
   All three in one runnable `index.ts`, plus `npm install` and `package.json`/`tsconfig.json` notes. Each code sample rendered via `<CopyBlock code={...} />`.
4. **Building with Python** — same three-primitive treatment using FastMCP's `@mcp.tool()`, `@mcp.resource()`, `@mcp.prompt()` decorators, via `CopyBlock`.
5. **Tools, Resources & Prompts** — keep the existing conceptual list (now backed by real examples above rather than floating alone).
6. **Local testing** — expand: MCP Inspector command (existing), plus a copyable `claude_desktop_config.json` snippet showing how to point Claude Desktop at the dev server (`node dist/index.js` / `uv run server.py`), and a one-line mention of `claude mcp add` for Claude Code.
7. **Deploying a remote server** — new. Explain stdio (local subprocess) vs. HTTP/SSE (remote, hosted) transports, then one concrete example: deploying a remote MCP server on Cloudflare Workers using `McpAgent` from the `agents` package, with a minimal `CopyBlock` code sample and a link to Cloudflare's MCP docs.
8. **Publishing checklist** — expand existing publish section into a short ordered checklist: publish to NPM/PyPI or GitHub, write a clear README with config snippet, pick a license, tag a semver release, then submit via `/submit`.
9. **FAQ** — new. 5-6 Q&As (plain content, e.g.: "Which language should I use?", "Do I need to host my server, or can it run locally?", "Is MCP the same as OpenAI function calling?", "How do I test without restarting Claude Desktop every time?", "Do I need authentication?", "How do I get listed on AllMCPs?"). Rendered as visible content AND fed into a new `FAQPage` JSON-LD block (separate `<script>` tag alongside the existing `TechArticle` JSON-LD — both are valid on one page).
10. **Further reading** — new closing section: external links (MCP spec at modelcontextprotocol.io, TypeScript SDK repo, Python SDK repo) and internal links to `/what-is-mcp`, `/guide`, `/browse`, `/categories`, `/submit`.

Metadata (`title`/`description`/OG/canonical) gets refreshed to reflect the deeper content but keeps the same URL and general topical framing so it doesn't reset any existing ranking signal.

## Part 2 — Internal link graph fixes

The three "pillar" content pages (`/`, `/what-is-mcp`, `/guide`, `/build-mcp-server`) currently don't cross-link:

- **`app/page.tsx`**: add a link (card or text link in an existing section) pointing to `/build-mcp-server`.
- **`app/what-is-mcp/page.tsx`**: add a `/build-mcp-server` link in its "next steps" list (it currently links `/browse` and `/guide` only).
- **`app/guide/page.tsx`**: add a `/build-mcp-server` link in its "Next steps" list (currently links `/what-is-mcp`, `/browse`, `/submit`).
- **`components/SiteFooter.tsx`**: add a "Build an MCP Server" link under the "Resources" column.

## Part 3 — Sitemap / llms.txt fixes

- **`app/sitemap.ts`**: add a `/pricing` entry (currently missing entirely despite being a public, indexable marketing page). Priority/changefreq in line with similar static pages (e.g. `priority: 0.7`, `changeFrequency: 'monthly'`).
- **`app/verify-request/page.tsx`**: add a minimal `export const metadata` with `robots: { index: false, follow: false }`, matching the pattern already used on `/login`. (Every other page in `app/*/page.tsx` already exports metadata; this is the one gap.)
- **`app/llms.txt/route.ts`**: add `/build-mcp-server` and `/pricing` to the "Useful Links" section.

## Out of scope

- No changes to `/admin`, `/dashboard`, `/login` (already correctly noindexed).
- No new blog post.
- No changes to `llms-full.txt` (purely a server-data export, unrelated to static pages).
- No redesign of existing JSON-LD/canonical/robots patterns elsewhere — audit found them already correct.

## Testing

- `npm run build` to confirm the expanded page compiles and TypeScript passes.
- Manually verify in dev server: new sections render, `CopyBlock` copy buttons work, JSON-LD blocks are valid JSON, new nav anchors scroll correctly, cross-links resolve.
