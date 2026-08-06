# Agent Markdown Coverage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the content-free placeholder that `/api/v1/markdown-renderer` currently returns for blog posts and category pages with real, content-accurate markdown, so AI crawlers requesting `Accept: text/markdown` (or `?format=md`) on those pages get the actual page content instead of a boilerplate stub.

**Architecture:** `middleware.ts` already rewrites any non-API, non-well-known path requested as markdown to `GET /api/v1/markdown-renderer?path=<original path>` (see `middleware.ts:69-82`). Today that route only has real content for `path === '/'`; everything else falls through to a generic stub (`app/api/v1/markdown-renderer/route.ts:35-44`). This plan adds two new page types — blog posts and category pages — as pattern-matched branches in that same route, backed by a new `lib/agentMarkdown.ts` module of pure, unit-testable formatting functions plus thin data-fetching wrappers. It reuses existing data access (`lib/blog.ts`, `lib/servers.ts`, `lib/categories.ts`) rather than introducing new fetch paths, and extracts one piece of duplicated copy (`introCopy`) out of the category page component so the HTML page and the markdown renderer render from the same intro text.

Tools pages, `/best/*`, `/guides`, and other page types are explicitly **out of scope** for this plan — they're either interactive (tools) or lower-traffic; revisit only if this pattern proves valuable.

**Tech Stack:** Next.js 16 App Router route handlers, TypeScript, `gray-matter` (blog frontmatter, already in use), plain `assert()`-based test scripts run via `npx tsx <file>.test.ts` (this repo's existing convention — see `lib/listingEnrich.test.ts`, no test framework/runner is configured beyond that).

---

### Task 1: Extract `categoryIntroCopy` into `lib/categories.ts`

The category page (`app/categories/[slug]/page.tsx:38-70`) has a private `CURATED_INTRO` map and `introCopy()` function that builds the one-paragraph intro for each category. The markdown renderer needs the same copy for category pages, so it needs to be importable from `lib/categories.ts` instead of living inside the page component.

**Files:**
- Modify: `lib/categories.ts`
- Modify: `app/categories/[slug]/page.tsx:38-70,137`
- Test: `lib/categories.test.ts` (new)

**Step 1: Write the failing test**

Create `lib/categories.test.ts`:

```ts
import { categoryIntroCopy } from './categories';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('Testing categoryIntroCopy...');

// 1. Curated categories return their hand-written intro verbatim.
const curated = categoryIntroCopy('💻 Developer Tools', 42, ['Foo', 'Bar', 'Baz']);
assert(curated.startsWith('MCP servers that plug AI agents'), 'Curated intro should be used for Developer Tools');

// 2. Uncurated categories fall back to the templated paragraph.
const templated = categoryIntroCopy('🧬 Biology & Bioinformatics', 3, ['Foo', 'Bar']);
assert(templated.includes('3 Biology & Bioinformatics MCP servers'), 'Templated intro should include count + label');
assert(templated.includes('Popular picks include Foo, Bar'), 'Templated intro should list top examples when >= 2 given');

// 3. Singular count doesn't pluralize "server".
const singular = categoryIntroCopy('🧬 Biology & Bioinformatics', 1, []);
assert(singular.includes('1 Biology & Bioinformatics MCP server.') || singular.includes('1 Biology & Bioinformatics MCP server '), 'Count of 1 should not pluralize "server"');
assert(!singular.includes('Popular picks'), 'No examples should be listed when fewer than 2 names given');

console.log('ALL TESTS PASSED SUCCESSFULLY!');
```

**Step 2: Run test to verify it fails**

Run: `npx tsx lib/categories.test.ts`
Expected: FAIL — `categoryIntroCopy` is not exported from `lib/categories.ts` (module has no such export).

**Step 3: Move the implementation into `lib/categories.ts`**

Append to `lib/categories.ts` (after `normalizeCategory`, before the trailing blank lines):

```ts
/**
 * Hand-written intros for the highest-traffic categories; every other category gets a
 * templated-but-unique paragraph (label + count + named examples) so no page is thin
 * or duplicated. Shared by the category HTML page and the agent markdown renderer.
 */
const CURATED_CATEGORY_INTRO: Record<string, string> = {
  'developer-tools':
    'MCP servers that plug AI agents straight into the developer workflow — running code, managing repositories, querying build systems, and automating the everyday tasks engineers repeat all day.',
  'databases':
    'Connect Claude, Cursor, and other AI agents to your data. These MCP servers expose SQL and NoSQL databases, warehouses, and query engines so an agent can read, analyze, and (carefully) write real records.',
  'security':
    'Security-focused MCP servers for scanning, auditing, secrets management, and threat analysis — giving AI agents safe, scoped access to the tools security teams already rely on.',
  'search-and-data-extraction':
    'MCP servers that let agents search the web, scrape pages, and pull structured data out of unstructured sources — turning the open internet into a queryable tool.',
  'finance-and-fintech':
    'From market data to payments and on-chain activity, these MCP servers give AI agents access to financial APIs and fintech infrastructure with the guardrails that domain demands.',
  'knowledge-and-memory':
    'Persistent memory, note stores, and knowledge bases exposed over MCP, so agents can remember context across sessions and reason over your accumulated knowledge.',
  'browser-automation':
    'Drive a real browser from an AI agent: navigate, click, fill forms, and extract content. These MCP servers wrap headless browsers and automation frameworks behind the protocol.',
  'social-media':
    'MCP servers for posting, reading, and analyzing across social platforms — letting agents draft, schedule, and monitor content programmatically.',
  'data-platforms':
    'Analytics warehouses, data pipelines, and BI platforms exposed over MCP, so agents can pull metrics and run analysis against your production data stack.',
  'cloud-platforms':
    'Provision, inspect, and manage cloud infrastructure through MCP — giving agents scoped access to the APIs behind your deployments.',
};

/** Builds the one-paragraph intro for a category landing page / markdown export. */
export function categoryIntroCopy(category: string, count: number, topNames: string[]): string {
  const slug = categorySlug(category);
  if (CURATED_CATEGORY_INTRO[slug]) return CURATED_CATEGORY_INTRO[slug];
  const { label } = parseCategoryLabel(category);
  const examples =
    topNames.length >= 2
      ? ` Popular picks include ${topNames.slice(0, 3).join(', ')}.`
      : '';
  return `Discover ${count.toLocaleString()} ${label} MCP server${count === 1 ? '' : 's'} for AI agents. Browse, compare, and install Model Context Protocol tools that connect Claude, Cursor, and other clients to ${label.toLowerCase()} capabilities.${examples}`;
}
```

**Step 4: Run test to verify it passes**

Run: `npx tsx lib/categories.test.ts`
Expected: PASS — `ALL TESTS PASSED SUCCESSFULLY!`

**Step 5: Update the category page to use the shared helper**

In `app/categories/[slug]/page.tsx`:
- Delete the local `CURATED_INTRO` const (lines 38-59) and the local `introCopy` function (lines 61-70).
- Add `categoryIntroCopy` to the existing `lib/categories` import (line 10-16).
- Change the call site at line 137 from `introCopy(category, total, topNames)` to `categoryIntroCopy(category, total, topNames)`.

**Step 6: Commit**

```bash
git add lib/categories.ts lib/categories.test.ts "app/categories/[slug]/page.tsx"
git commit -m "refactor: extract category intro copy into lib/categories.ts"
```

---

### Task 2: Add a lightweight, README-free server summary line

`formatServerAsMarkdown` (`lib/servers.ts:432-511`) fetches each server's GitHub README over the network — fine for a single listing page, far too slow (and rate-limit-prone) to call once per server when rendering a category page with dozens of listings. Add a one-line summary formatter with no network I/O for that use case.

**Files:**
- Modify: `lib/servers.ts`
- Test: `lib/servers.test.ts` (new)

**Step 1: Write the failing test**

Create `lib/servers.test.ts`:

```ts
import { formatServerSummaryLine, type Server } from './servers';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function fakeServer(overrides: Partial<Server> = {}): Server {
  return {
    id: 'demo-server',
    name: 'Demo Server',
    url: 'https://github.com/demo/demo-server',
    description: 'A demo MCP server for testing.',
    category: '💻 Developer Tools',
    isOfficial: false,
    status: 'active',
    createdAt: '2026-01-01',
    ...overrides,
  };
}

console.log('Testing formatServerSummaryLine...');

// 1. With stars and installs, both are shown.
const withStats = formatServerSummaryLine(fakeServer({ githubStars: 1200, copies: 340 }));
assert(withStats.includes('[Demo Server](https://allmcps.com/mcp/demo-server)'), 'Should link to the listing page');
assert(withStats.includes('⭐ 1,200'), 'Should show formatted star count');
assert(withStats.includes('340 installs'), 'Should show install count');
assert(withStats.includes('A demo MCP server for testing.'), 'Should include the description');

// 2. With no stats at all, no empty parens are emitted.
const noStats = formatServerSummaryLine(fakeServer({ githubStars: null, copies: 0 }));
assert(!noStats.includes('()'), 'Should not render empty parens when there are no stats');

console.log('ALL TESTS PASSED SUCCESSFULLY!');
```

**Step 2: Run test to verify it fails**

Run: `npx tsx lib/servers.test.ts`
Expected: FAIL — `formatServerSummaryLine` is not exported from `lib/servers.ts`.

**Step 3: Write minimal implementation**

Add to `lib/servers.ts`, immediately after `formatServerAsMarkdown` (after line 511):

```ts
/**
 * One-line markdown summary for a server, with no network I/O — safe to call for every
 * listing on a category page. Contrast with formatServerAsMarkdown, which fetches the
 * README and is only used for single-listing pages.
 */
export function formatServerSummaryLine(server: Server): string {
  const bits: string[] = [];
  if (typeof server.githubStars === 'number') bits.push(`⭐ ${server.githubStars.toLocaleString()}`);
  if (server.copies) bits.push(`${server.copies.toLocaleString()} installs`);
  const meta = bits.length ? ` (${bits.join(' · ')})` : '';
  return `- [${server.name}](https://allmcps.com/mcp/${server.id})${meta} — ${server.description}`;
}
```

**Step 4: Run test to verify it passes**

Run: `npx tsx lib/servers.test.ts`
Expected: PASS — `ALL TESTS PASSED SUCCESSFULLY!`

**Step 5: Commit**

```bash
git add lib/servers.ts lib/servers.test.ts
git commit -m "feat: add README-free server summary line for list rendering"
```

---

### Task 3: Create `lib/agentMarkdown.ts` with blog + category formatters

Pure formatting functions (take already-fetched data, return a string) are unit-tested directly with fake data. Thin `render*` wrappers do the actual data fetching (`getAllPosts`, `getPostBySlug`, `getActiveServers`) and are exercised in Task 5's manual verification, not unit tests — they have no logic of their own beyond "fetch, filter, delegate to the pure formatter."

**Files:**
- Create: `lib/agentMarkdown.ts`
- Test: `lib/agentMarkdown.test.ts` (new)

**Step 1: Write the failing test**

Create `lib/agentMarkdown.test.ts`:

```ts
import {
  formatBlogPostMarkdown,
  formatBlogIndexMarkdown,
  formatCategoryMarkdown,
  formatCategoryIndexMarkdown,
} from './agentMarkdown';
import type { BlogPost } from './blog';
import type { Server } from './servers';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function fakePost(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    slug: 'demo-post',
    title: 'Demo Post Title',
    date: '2026-08-01',
    excerpt: 'A one-sentence summary of the demo post.',
    tags: ['MCP', 'Agents'],
    faq: [{ q: 'Is this a demo?', a: 'Yes.' }],
    readingTime: 4,
    content: 'This is the **full markdown body** of the demo post.',
    ...overrides,
  };
}

function fakeServer(overrides: Partial<Server> = {}): Server {
  return {
    id: 'demo-server',
    name: 'Demo Server',
    url: 'https://github.com/demo/demo-server',
    description: 'A demo MCP server for testing.',
    category: '💻 Developer Tools',
    isOfficial: false,
    status: 'active',
    createdAt: '2026-01-01',
    ...overrides,
  };
}

console.log('Testing lib/agentMarkdown...');

// formatBlogPostMarkdown
const postMd = formatBlogPostMarkdown(fakePost());
assert(postMd.includes('# Demo Post Title'), 'Should render title as H1');
assert(postMd.includes('This is the **full markdown body**'), 'Should include the raw post content, not a summary');
assert(postMd.includes('**Tags:** MCP, Agents'), 'Should list tags');
assert(postMd.includes('## Frequently Asked Questions'), 'Should render FAQ section when present');
assert(postMd.includes('Is this a demo?'), 'Should include FAQ question text');

const postMdNoFaq = formatBlogPostMarkdown(fakePost({ faq: [] }));
assert(!postMdNoFaq.includes('Frequently Asked Questions'), 'Should omit FAQ section when there is none');

// formatBlogIndexMarkdown
const indexMd = formatBlogIndexMarkdown([fakePost(), fakePost({ slug: 'second-post', title: 'Second Post' })]);
assert(indexMd.includes('[Demo Post Title](https://allmcps.com/blog/demo-post)'), 'Should link each post');
assert(indexMd.includes('[Second Post](https://allmcps.com/blog/second-post)'), 'Should list every post given');

// formatCategoryMarkdown
const catMd = formatCategoryMarkdown('💻 Developer Tools', [
  fakeServer({ id: 'a', name: 'Server A', githubStars: 500 }),
  fakeServer({ id: 'b', name: 'Server B', copies: 10 }),
]);
assert(catMd.includes('# Developer Tools MCP Servers'), 'Should render category label as H1');
assert(catMd.includes('[Server A](https://allmcps.com/mcp/a)'), 'Should list every server in the category');
assert(catMd.includes('[Server B](https://allmcps.com/mcp/b)'), 'Should list every server in the category');
assert(catMd.includes('**Listed servers:** 2'), 'Should report the listing count');

const emptyCatMd = formatCategoryMarkdown('🧬 Biology & Bioinformatics', []);
assert(emptyCatMd.includes('No servers are currently listed'), 'Should handle an empty category without crashing');

// formatCategoryIndexMarkdown
const catIndexMd = formatCategoryIndexMarkdown([
  { category: '💻 Developer Tools', count: 42 },
  { category: '🗄️ Databases', count: 7 },
]);
assert(catIndexMd.includes('[💻 Developer Tools](https://allmcps.com/categories/developer-tools) — 42 servers'), 'Should link each category with its count');

console.log('ALL TESTS PASSED SUCCESSFULLY!');
```

**Step 2: Run test to verify it fails**

Run: `npx tsx lib/agentMarkdown.test.ts`
Expected: FAIL — `lib/agentMarkdown.ts` does not exist.

**Step 3: Write the implementation**

Create `lib/agentMarkdown.ts`:

```ts
import { getAllPosts, getPostBySlug, type BlogPost } from './blog';
import { getActiveServers, formatServerSummaryLine, relatedRankingScore, type Server } from './servers';
import { DIRECTORY_CATEGORIES, categoryFromSlug, categorySlug, parseCategoryLabel, categoryIntroCopy } from './categories';

const SITE = 'https://allmcps.com';

/** Category pages cap the listed servers to match the HTML page's MAX_CARDS. */
const MAX_LISTED_SERVERS = 60;

export function formatBlogPostMarkdown(post: BlogPost): string {
  let md = `# ${post.title}\n\n`;
  md += `> ${post.excerpt}\n\n`;
  md += `**Published:** ${post.date}  \n`;
  if (post.tags.length > 0) md += `**Tags:** ${post.tags.join(', ')}  \n`;
  md += `**Reading time:** ${post.readingTime} min  \n`;
  md += `**URL:** ${SITE}/blog/${post.slug}\n\n`;
  md += `---\n\n`;
  md += `${post.content}\n`;

  if (post.faq.length > 0) {
    md += `\n## Frequently Asked Questions\n\n`;
    for (const { q, a } of post.faq) {
      md += `**${q}**\n${a}\n\n`;
    }
  }

  return md;
}

export function formatBlogIndexMarkdown(posts: BlogPost[]): string {
  let md = `# AllMCPs Blog\n\n`;
  md += `${posts.length} post${posts.length === 1 ? '' : 's'} on the Model Context Protocol, AI agent tooling, and directory updates.\n\n`;

  for (const post of posts) {
    md += `## [${post.title}](${SITE}/blog/${post.slug})\n`;
    md += `${post.date} · ${post.readingTime} min read\n\n`;
    md += `${post.excerpt}\n\n`;
  }

  return md;
}

export function formatCategoryMarkdown(category: string, servers: Server[]): string {
  const { label } = parseCategoryLabel(category);
  const slug = categorySlug(category);
  const ranked = [...servers].sort((a, b) => relatedRankingScore(b) - relatedRankingScore(a));
  const topNames = ranked.slice(0, 3).map((s) => s.name);
  const intro = categoryIntroCopy(category, servers.length, topNames);

  let md = `# ${label} MCP Servers\n\n`;
  md += `${intro}\n\n`;
  md += `**Category page:** ${SITE}/categories/${slug}\n`;
  md += `**Listed servers:** ${servers.length}\n\n`;

  if (ranked.length === 0) {
    md += `No servers are currently listed in this category.\n`;
    return md;
  }

  md += `## Servers\n\n`;
  for (const server of ranked.slice(0, MAX_LISTED_SERVERS)) {
    md += `${formatServerSummaryLine(server)}\n`;
  }
  if (ranked.length > MAX_LISTED_SERVERS) {
    md += `\n...and ${ranked.length - MAX_LISTED_SERVERS} more. Full list: ${SITE}/categories/${slug}\n`;
  }

  return md;
}

export function formatCategoryIndexMarkdown(counts: { category: string; count: number }[]): string {
  let md = `# AllMCPs Categories\n\n`;
  md += `Browse the full MCP server directory by category.\n\n`;

  for (const { category, count } of counts) {
    const { emoji, label } = parseCategoryLabel(category);
    md += `- [${emoji} ${label}](${SITE}/categories/${categorySlug(category)}) — ${count} server${count === 1 ? '' : 's'}\n`;
  }

  return md;
}

/** Returns null when the slug doesn't match a known post, so the route can 404. */
export async function renderBlogPostMarkdown(slug: string): Promise<string | null> {
  const post = getPostBySlug(slug);
  return post ? formatBlogPostMarkdown(post) : null;
}

export async function renderBlogIndexMarkdown(): Promise<string> {
  return formatBlogIndexMarkdown(getAllPosts());
}

/** Returns null when the slug doesn't match a known category, so the route can 404. */
export async function renderCategoryMarkdown(slug: string): Promise<string | null> {
  const category = categoryFromSlug(slug);
  if (!category) return null;
  const servers = await getActiveServers();
  const inCategory = servers.filter((s) => s.category === category);
  return formatCategoryMarkdown(category, inCategory);
}

export async function renderCategoryIndexMarkdown(): Promise<string> {
  const servers = await getActiveServers();
  const counts = DIRECTORY_CATEGORIES.map((category) => ({
    category,
    count: servers.filter((s) => s.category === category).length,
  }));
  return formatCategoryIndexMarkdown(counts);
}
```

**Step 4: Run test to verify it passes**

Run: `npx tsx lib/agentMarkdown.test.ts`
Expected: PASS — `ALL TESTS PASSED SUCCESSFULLY!`

**Step 5: Commit**

```bash
git add lib/agentMarkdown.ts lib/agentMarkdown.test.ts
git commit -m "feat: add blog and category markdown formatters"
```

---

### Task 4: Wire the new renderers into the markdown-renderer route

**Files:**
- Modify: `app/api/v1/markdown-renderer/route.ts`

**Step 1: Replace the route body**

Current file (`app/api/v1/markdown-renderer/route.ts`) has one `if (path === '/' ...) { ... } else { <generic stub> }`. Change it to:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { encode } from 'gpt-tokenizer';
import {
  renderBlogPostMarkdown,
  renderBlogIndexMarkdown,
  renderCategoryMarkdown,
  renderCategoryIndexMarkdown,
} from '@/lib/agentMarkdown';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const path = searchParams.get('path') || '/';

  const blogPostMatch = path.match(/^\/blog\/([^/]+)\/?$/);
  const categoryMatch = path.match(/^\/categories\/([^/]+)\/?$/);

  let markdown: string | null;

  if (path === '/' || path === '') {
    markdown = `# AllMCPs - The Model Context Protocol Directory & Search Engine

Welcome to AllMCPs.com, the premier index of Model Context Protocol (MCP) servers, web tools, and AI agent integrations.

## Quick Links
- **API Catalog**: [https://allmcps.com/.well-known/api-catalog](file:///.well-known/api-catalog)
- **API Documentation**: [https://allmcps.com/docs/api](file:///docs/api)
- **OpenAPI Spec**: [https://allmcps.com/api/v1/openapi.json](file:///api/v1/openapi.json)
- **Agent Skills**: [https://allmcps.com/.well-known/agent-skills/index.json](file:///.well-known/agent-skills/index.json)
- **MCP Server Card**: [https://allmcps.com/.well-known/mcp/server-card.json](file:///.well-known/mcp/server-card.json)
- **Auth Metadata**: [https://allmcps.com/auth.md](file:///auth.md)

## Categories
- Developer Tools
- Databases & Storage
- Cloud & Infrastructure
- AI & LLM Utilities
- Search & Knowledge Base
- Workflow Automation

## Search API
Perform programmatic queries against our directory:
\`GET https://allmcps.com/api/v1/search?q={query}&category={category}&limit=10\`
`;
  } else if (path === '/blog' || path === '/blog/') {
    markdown = await renderBlogIndexMarkdown();
  } else if (blogPostMatch) {
    markdown = await renderBlogPostMarkdown(blogPostMatch[1]);
  } else if (path === '/categories' || path === '/categories/') {
    markdown = await renderCategoryIndexMarkdown();
  } else if (categoryMatch) {
    markdown = await renderCategoryMarkdown(categoryMatch[1]);
  } else {
    markdown = `# AllMCPs - Path: ${path}

Content requested in Markdown format for AI Agents.

- **URL**: https://allmcps.com${path}
- **API Catalog**: https://allmcps.com/.well-known/api-catalog
- **Documentation**: https://allmcps.com/docs/api
`;
  }

  if (markdown === null) {
    return new NextResponse(`# 404 - Not Found\n\nNo content found for \`${path}\`.\n`, {
      status: 404,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  }

  let tokens = 0;
  try {
    tokens = encode(markdown).length;
  } catch {
    tokens = Math.ceil(markdown.length / 4);
  }

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'x-markdown-tokens': tokens.toString(),
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
```

Note: the homepage branch and the final `else` fallback are unchanged from the current file — only the two new branches and the null/404 handling are new.

**Step 2: Commit**

```bash
git add app/api/v1/markdown-renderer/route.ts
git commit -m "feat: serve real markdown for blog and category pages"
```

---

### Task 5: Manual verification against the dev server

This repo has no test harness for Next.js route handlers (see Tech Stack note), so this route is verified by actually running it.

**Step 1:** Start the dev server in the background: `npm run dev` (leave it running; default port 3000).

**Step 2:** Confirm the blog index now returns real content:

Run: `curl -s -H "Accept: text/markdown" http://localhost:3000/blog`
Expected: Starts with `# AllMCPs Blog`, followed by real post titles/excerpts pulled from `content/blog/*.md` — not the old `# AllMCPs - Path: /blog` stub.

**Step 3:** Pick a real slug from `content/blog/` and confirm the post page returns its actual body:

Run: `curl -s -H "Accept: text/markdown" http://localhost:3000/blog/<real-slug>`
Expected: Contains the post's real `##` headings and body text (compare against the source `.md` file), plus a `Frequently Asked Questions` section if that post has a `faq` block.

**Step 4:** Confirm a nonexistent post 404s instead of silently returning a stub:

Run: `curl -s -o /dev/null -w "%{http_code}\n" -H "Accept: text/markdown" http://localhost:3000/blog/not-a-real-slug`
Expected: `404`

**Step 5:** Confirm the categories index and a real category page:

Run: `curl -s "http://localhost:3000/categories?format=md"`
Expected: `# AllMCPs Categories` followed by one bullet per category with real listing counts.

Run: `curl -s "http://localhost:3000/categories/developer-tools?format=md"`
Expected: `# Developer Tools MCP Servers`, the curated intro paragraph, and real server names linking to `/mcp/{id}`.

**Step 6:** Confirm the existing `/mcp/{id}` and homepage markdown paths still work (regression check):

Run: `curl -s -H "Accept: text/markdown" http://localhost:3000/` — should still return the homepage quick-links content.
Run: `curl -s http://localhost:3000/mcp/<real-id>.md` — should still return the existing per-listing markdown (untouched by this plan).

**Step 7:** Stop the dev server once all checks pass.

---

### Task 6 (optional, small): Correct the API docs wording

`app/docs/api/page.tsx:229-232` currently says markdown negotiation applies to "listing URLs," which undersells the new coverage without being wrong. Low-priority, but cheap to fix while it's fresh.

**Files:**
- Modify: `app/docs/api/page.tsx:230-232`

**Step 1:** Change:

```tsx
Markdown negotiation: send <code>Accept: text/markdown</code> or append{' '}
<code>?format=md</code> / <code>.md</code> to listing URLs.
```

to:

```tsx
Markdown negotiation: send <code>Accept: text/markdown</code> or append{' '}
<code>?format=md</code> / <code>.md</code> to listing, blog, or category URLs.
```

**Step 2: Commit**

```bash
git add app/docs/api/page.tsx
git commit -m "docs: note blog and category markdown coverage"
```

---

## Explicitly out of scope

- **Tools pages** (`/tools/*`) — interactive components (config auditors, playgrounds); a markdown export would need bespoke per-tool summaries with much lower payoff.
- **`/best/{topic}`** — same data shape as categories (servers + curated copy), so this pattern extends cleanly if it's wanted later, but it's a separate `lib/bestTopics.ts` data source and wasn't part of what was scoped here.
- **Rewriting the generic fallback stub** for every other path — left as-is; it's honest enough as a "no dedicated export yet" placeholder once blog/category pages (the two content-heavy types) are covered.
