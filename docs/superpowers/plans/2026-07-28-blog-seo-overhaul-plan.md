# Blog SEO/AEO Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single hardcoded blog page with a markdown-file-driven blog: real per-post URLs with JSON-LD, an RSS feed, a searchable/taggable listing UI, a rewritten long-form first post, and an `AGENTS.md` convention so future posts are just a markdown file.

**Architecture:** `content/blog/YYYY-MM-DD-slug.md` files (frontmatter via `gray-matter`) are read by `lib/blog.ts` at build time only. All blog routes are statically generated (`force-static` / `dynamicParams = false`) so `fs` never executes inside the deployed Cloudflare Worker — only Next's `next build` step touches the filesystem.

**Tech Stack:** Next.js 16 (App Router), React 19, `gray-matter` (new dependency), existing `react-markdown`-based `SafeMarkdown` component, existing CSS primitives (`surface`, `directory-tag`, `badge`, `markdown-body`, `breadcrumb`).

## Global Constraints

- Site base URL for all canonical/OG/JSON-LD/RSS URLs: `https://allmcps.com` (matches every existing page in this repo).
- Author/publisher for all post JSON-LD is the `Organization` "AllMCPs" only — no individual byline (confirmed with the user).
- Every blog route (`app/blog/page.tsx`, `app/blog/[slug]/page.tsx`, `app/blog/rss.xml/route.ts`) must be statically generated: `export const dynamic = 'force-static'` on the listing page and RSS route, `export const dynamicParams = false` plus `generateStaticParams` on the post route. This is a hard requirement, not a style choice — Cloudflare Workers (this app's deploy target via OpenNext) have no real filesystem at request time, so any `fs` call must run during `next build`, never per-request. `app/sitemap.ts` already relies on the same "runs at build, falls back gracefully" behavior for its D1 lookup; the new blog code in that file follows the identical try/catch pattern.
- Heading text inside post markdown bodies (`## ...` lines) must be plain text — no bold/italic/inline code. The table-of-contents feature works by replacing `## Heading` lines with raw `<h2 id="...">Heading</h2>` HTML before handing the string to `SafeMarkdown`; raw HTML blocks are not re-processed for inline markdown, so formatting inside a heading would render as literal asterisks/backticks.
- `rehype-sanitize`'s default schema (already used inside `SafeMarkdown`) rewrites every `id` attribute with a `user-content-` prefix (`hast-util-sanitize`'s `clobberPrefix`, confirmed by reading `node_modules/hast-util-sanitize/lib/schema.js`). Anywhere an href needs to point at one of these injected heading ids, it must be `#user-content-<slug>`, not `#<slug>`.
- No test framework is configured in this repo (no `jest`/`vitest`/test script in `package.json`). Verification steps in this plan use `npx tsc --noEmit` for type safety and `npm run dev` / `npm run build` + manual `curl`/browser checks for behavior — this matches how the rest of the codebase is verified (see the "Testing" section of the design spec).
- New/edited files use relative imports (`../../lib/...`), matching every existing file in `app/` and `components/` — the `@/*` path alias in `tsconfig.json` exists but is unused by convention.
- RSS feed content is excerpt-only (title/link/pubDate/guid/description) — no full-text `content:encoded`, per the design's "not too sophisticated" brief.

---

### Task 1: Content pipeline — rewritten post + `lib/blog.ts`

**Files:**
- Create: `content/blog/2026-07-27-launching-allmcps.md`
- Create: `lib/blog.ts`
- Modify: `package.json` (adds `gray-matter` dependency, via `npm install`)

**Interfaces:**
- Produces (used by every later task):
  ```ts
  export type BlogFaq = { q: string; a: string };
  export type BlogPost = {
    slug: string;
    title: string;
    date: string; // "YYYY-MM-DD", derived from filename
    excerpt: string;
    tags: string[];
    faq: BlogFaq[];
    readingTime: number; // minutes, rounded up, minimum 1
    content: string; // raw markdown body, frontmatter stripped
  };
  export function getAllPosts(): BlogPost[]; // newest first
  export function getPostBySlug(slug: string): BlogPost | undefined;
  export function getAllTags(): string[]; // sorted, deduped
  ```

- [ ] **Step 1: Install `gray-matter`**

Run: `npm install gray-matter`
Expected: `package.json` gains `"gray-matter": "^4.0.3"` (or newer patch) under `dependencies`; `package-lock.json` updates.

- [ ] **Step 2: Write the rewritten long-form post**

Create `content/blog/2026-07-27-launching-allmcps.md` with this exact content:

````markdown
---
title: "Launching AllMCPs: A Directory for Model Context Protocol Servers"
excerpt: "Why MCP server discovery is broken, how AllMCPs fixes it, and a practical guide to evaluating, installing, and claiming servers in the directory."
tags: ["MCP", "Announcements"]
faq:
  - q: "Do I need to pay to list my MCP server on AllMCPs?"
    a: "No. Submitting and listing a server is free. Claiming ownership and unlocking premium placement are optional upgrades on top of a free listing."
  - q: "How does a listing become Verified?"
    a: "A listing is marked Verified once its owner claims it by proving control of the linked GitHub repository or website — either with a DNS TXT record or a small badge/verification file — or by holding an active premium subscription."
  - q: "Does AllMCPs only work with Claude Desktop?"
    a: "No. Any MCP-compatible client that reads a standard mcpServers configuration block — including Claude Desktop, Claude Code, and other MCP hosts — can use the install snippets on AllMCPs listings."
  - q: "How often is the directory updated?"
    a: "New submissions go live after a quick review, and existing listings are re-checked on a recurring schedule, so broken or archived servers surface with an accurate health status instead of silently going stale."
---

> **TL;DR:** MCP (Model Context Protocol) is the open standard that lets AI agents call real tools instead of guessing. The ecosystem already has thousands of servers, but they're scattered across GitHub repos and READMEs with no common way to search, compare, or verify them. AllMCPs is the directory that fixes that — browse and search by category, copy a ready-to-paste install config for your agent, and claim your own server once it's listed. This post covers what MCP actually is, how to evaluate a server before installing it, and how the directory works end to end.

## What MCP is, and why finding a good server is harder than it should be

Model Context Protocol is an open protocol for connecting AI applications to the outside world. Instead of every AI app inventing its own bespoke way to talk to a database, a filesystem, a ticketing system, or an internal company API, MCP defines one standard interface. An AI application (the "host" — Claude Desktop, Claude Code, an IDE extension, or any other MCP-compatible client) talks to small, focused processes called MCP servers. Each server exposes a set of tools, resources, and prompts over a simple JSON-RPC based protocol, and the host decides when to call them on the model's behalf.

The practical effect is that instead of N applications each writing M custom integrations, you get N applications and M servers that all speak the same language. It's often described as a USB-C port for AI applications — one physical interface, many devices on either end.

Because the protocol is simple and open, the number of available servers exploded within months of release: servers for relational databases, browsers, filesystems, project management tools, CI pipelines, and countless internal APIs. That growth is good for choice and bad for discovery. Servers live scattered across individual GitHub repositories with wildly inconsistent README quality, there's no shared place to compare two servers that claim to do the same job, and there's no easy way to check whether a project is still maintained or whether it's safe to run arbitrary code from it on your machine before you wire it into an agent that can act on your behalf.

## What AllMCPs actually does

AllMCPs is a directory built specifically for this problem, not a general software catalog with MCP support bolted on.

- [Browse](/browse) by category or search across every listing's name and description.
- Every listing page pulls the live README straight from GitHub and shows the exact install snippet your agent needs — no digging through a repo to find the right JSON block.
- Listings carry badges that tell you at a glance what you're looking at: Official for first-party servers, Verified for listings whose owner has proven control of the linked repo or site, and Featured for promoted placements — so everything doesn't look identical.
- Basic health and popularity signals — views, install/copy counts, and upvotes — give you a rough read on whether a server is actually used and whether its source still resolves.
- An agent-friendly "copy prompt" button generates a ready-to-paste install instruction, so a coding agent can wire up a new MCP server itself instead of a human hand-copying JSON into a config file.

## How to evaluate an MCP server before you install it

An MCP server isn't a passive dependency — depending on what it exposes, it can read your filesystem, hit the network, or take actions against a live account on your behalf. A few minutes of evaluation up front is worth it:

- **Source.** Is this an official server from the tool's own maintainers, or a community implementation? Both can be fine, but they carry different trust assumptions.
- **Maintenance.** When was it last updated? An MCP server that hasn't been touched since the protocol changed underneath it is a liability, not a convenience.
- **Scope requested.** Read the tool list before you install. A filesystem server that only needs read access to one directory is a very different risk profile from one that can write anywhere on disk.
- **Transport.** Local servers run as a subprocess on your machine (stdio); remote servers run somewhere else and you're trusting that operator's infrastructure too. Know which one you're installing.
- **Verification status.** A Verified badge means the listed owner has proven they control the linked repository or site — it's not a security audit, but it does rule out a large class of impersonation.
- **Popularity signals.** Views, installs, and upvotes on AllMCPs are a rough proxy for "other people use this and it didn't immediately break," not a guarantee — treat them as one input, not the whole decision.

Treat every MCP server the way you'd treat any third-party dependency that gets real access to your system: read what it actually does before you grant it the ability to do it.

## Installing your first MCP server

Once you've picked a server on AllMCPs, installing it is usually a three-step process:

1. Open the listing and copy the install block — most servers on the directory run via `npx`, so there's nothing to separately download or build.
2. Paste it into your MCP client's configuration. For Claude Desktop, that's the `mcpServers` object in `claude_desktop_config.json`; other MCP hosts use the same shape with a different file location.
3. Restart the client and confirm the new tools show up in its tool list.

If you're driving this from an agent rather than doing it by hand, the "copy agent prompt" button on each listing produces an instruction an agent can act on directly — describe the goal, hand it the prompt, and let it edit the config file itself.

## Claiming and verifying your own server

If you maintain a server that's listed on AllMCPs — or you're submitting a new one — you can claim it once it's live. Claiming works like most domain-ownership checks: prove you control the linked GitHub repository or website, either by adding a DNS TXT record or by hosting a small verification badge file, and the listing flips to Verified.

Once claimed, you can edit your own listing's details directly, and verified listings get a reciprocal dofollow link back to the project's own site — a real trust signal for people browsing the directory, and a modest SEO benefit for the project itself.

If you haven't listed your server yet, start with [Submit](/submit); if it's already in the directory, open its page and look for the claim flow.

## What's next for AllMCPs

This blog is where directory updates, MCP ecosystem notes, and practical guides for installing and evaluating servers will live going forward. If you want the deeper background on the protocol itself, [What is MCP](/what-is-mcp) and the [Guide](/guide) cover that in more depth than a launch post can. And if there's a server you use that isn't listed yet, [submit it](/submit) — that's how the directory grows.

Built by [Jackalope Digital](https://jackalope.digital). Give your AI agents superpowers.
````

- [ ] **Step 3: Write `lib/blog.ts`**

```ts
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');
const FILENAME_PATTERN = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/;

export type BlogFaq = {
  q: string;
  a: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
  faq: BlogFaq[];
  readingTime: number;
  content: string;
};

function readPostFile(filename: string): BlogPost {
  const match = filename.match(FILENAME_PATTERN);
  if (!match) {
    throw new Error(`Blog post filename "${filename}" must match YYYY-MM-DD-slug.md`);
  }
  const [, date, slug] = match;

  const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf8');
  const { data, content } = matter(raw);

  if (!data.title || !data.excerpt) {
    throw new Error(`Blog post "${filename}" is missing required frontmatter (title, excerpt)`);
  }

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  return {
    slug,
    title: data.title as string,
    date,
    excerpt: data.excerpt as string,
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    faq: Array.isArray(data.faq) ? (data.faq as BlogFaq[]) : [],
    readingTime: Math.max(1, Math.ceil(wordCount / 200)),
    content: content.trim(),
  };
}

export function getAllPosts(): BlogPost[] {
  const filenames = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));
  return filenames.map(readPostFile).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return getAllPosts().find((post) => post.slug === slug);
}

export function getAllTags(): string[] {
  const tags = new Set<string>();
  for (const post of getAllPosts()) {
    for (const tag of post.tags) tags.add(tag);
  }
  return Array.from(tags).sort();
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `lib/blog.ts` or `content/blog/...`. (Pre-existing unrelated errors elsewhere in the repo, if any, are out of scope for this task — only confirm nothing new appears from these two files.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json content/blog/2026-07-27-launching-allmcps.md lib/blog.ts
git commit -m "$(cat <<'EOF'
Add blog content pipeline: markdown frontmatter parsing + rewritten launch post

lib/blog.ts reads content/blog/*.md at build time (fs only ever runs
during `next build`, never inside the deployed Cloudflare Worker).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Listing page — search, tags, JSON-LD

**Files:**
- Create: `components/BlogListClient.tsx`
- Modify: `app/blog/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `getAllPosts(): BlogPost[]`, `getAllTags(): string[]`, `BlogPost` type from `lib/blog.ts` (Task 1).
- Produces: `export function BlogListClient({ posts, tags }: { posts: BlogPost[]; tags: string[] }): JSX.Element` — no other task depends on this file directly.

- [ ] **Step 1: Write `components/BlogListClient.tsx`**

```tsx
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import type { BlogPost } from '../lib/blog';

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function BlogListClient({ posts, tags }: { posts: BlogPost[]; tags: string[] }) {
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesQuery =
        !q ||
        post.title.toLowerCase().includes(q) ||
        post.excerpt.toLowerCase().includes(q) ||
        post.tags.some((tag) => tag.toLowerCase().includes(q));
      const matchesTag = !activeTag || post.tags.includes(activeTag);
      return matchesQuery && matchesTag;
    });
  }, [posts, query, activeTag]);

  return (
    <>
      <div className="directory-filters" style={{ marginBottom: '2rem' }}>
        <div className="directory-filters-row">
          <Input
            type="text"
            placeholder="Search posts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search blog posts"
            style={{ flexGrow: 1, flexBasis: '280px', margin: 0, minWidth: 0 }}
          />
        </div>

        {tags.length > 0 && (
          <div className="directory-tags-row">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`directory-tag ${activeTag === tag ? 'directory-tag-active' : ''}`}
                aria-pressed={activeTag === tag}
                onClick={() => setActiveTag((current) => (current === tag ? null : tag))}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="surface" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No posts match your search or filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filtered.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="surface surface-interactive"
              style={{ padding: '1.75rem', display: 'block' }}
            >
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <time dateTime={post.date} className="text-meta" style={{ fontWeight: 600 }}>
                  {formatDate(post.date)}
                </time>
                <span className="text-meta">· {post.readingTime} min read</span>
              </div>
              <h2 className="text-section" style={{ margin: '0.5rem 0 0.75rem' }}>
                {post.title}
              </h2>
              <p style={{ margin: '0 0 1rem', lineHeight: 1.65, color: 'var(--text-secondary)' }}>{post.excerpt}</p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="category">
                    {tag}
                  </Badge>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Rewrite `app/blog/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { getAllPosts, getAllTags } from '../../lib/blog';
import { BlogListClient } from '../../components/BlogListClient';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'News, guides, and updates from the AllMCPs team — MCP directory, agent tooling, and launch notes.',
  alternates: {
    canonical: 'https://allmcps.com/blog',
    types: {
      'application/rss+xml': 'https://allmcps.com/blog/rss.xml',
    },
  },
  openGraph: {
    title: 'Blog | AllMCPs',
    description: 'News, guides, and updates from the AllMCPs team — MCP directory, agent tooling, and launch notes.',
    url: 'https://allmcps.com/blog',
  },
};

export default function BlogPage() {
  const posts = getAllPosts();
  const tags = getAllTags();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Blog',
        name: 'AllMCPs Blog',
        url: 'https://allmcps.com/blog',
        blogPost: posts.map((post) => ({
          '@type': 'BlogPosting',
          headline: post.title,
          url: `https://allmcps.com/blog/${post.slug}`,
          datePublished: post.date,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://allmcps.com/blog' },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="page-shell page-shell--content">
        <div className="page-shell-inner">
          <header className="page-header">
            <h1 className="text-page-title">Blog</h1>
            <p className="text-lead">Notes on MCP, agents, and the AllMCPs directory.</p>
          </header>

          <BlogListClient posts={posts} tags={tags} />
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `components/BlogListClient.tsx` or `app/blog/page.tsx`.

- [ ] **Step 4: Manual verification**

Run: `npm run dev` (in the background or a separate terminal), then in another terminal:
`curl -s http://localhost:3000/blog`
Expected: HTML response containing `Launching AllMCPs: A Directory for Model Context Protocol Servers`, `application/ld+json`, and the tag text `MCP` and `Announcements`. Also open `http://localhost:3000/blog` in a browser and confirm typing in the search box filters the (single) post, and clicking a tag chip toggles it active.

- [ ] **Step 5: Commit**

```bash
git add components/BlogListClient.tsx app/blog/page.tsx
git commit -m "$(cat <<'EOF'
Rebuild blog listing with search, tag filters, and JSON-LD

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Post page — TOC, FAQ, JSON-LD

**Files:**
- Create: `lib/blogToc.ts`
- Create: `app/blog/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getAllPosts`, `getPostBySlug`, `BlogPost`, `BlogFaq` from `lib/blog.ts` (Task 1); `SafeMarkdown` from `components/ui/SafeMarkdown.tsx`; `Badge` from `components/ui/Badge.tsx`.
- Produces (`lib/blogToc.ts`, used only by this task's page):
  ```ts
  export type TocEntry = { text: string; slug: string };
  export function extractToc(content: string): TocEntry[];
  export function withHeadingAnchors(content: string): string;
  export function tocHref(slug: string): string; // "#user-content-<slug>"
  ```

- [ ] **Step 1: Write `lib/blogToc.ts`**

```ts
export type TocEntry = {
  text: string;
  slug: string;
};

const HEADING_PATTERN = /^##\s+(.+)$/gm;
const USER_CONTENT_PREFIX = 'user-content-';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function extractToc(content: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const seen = new Map<string, number>();
  for (const match of content.matchAll(HEADING_PATTERN)) {
    const text = match[1].trim();
    let slug = slugify(text);
    const count = seen.get(slug) || 0;
    seen.set(slug, count + 1);
    if (count > 0) slug = `${slug}-${count}`;
    entries.push({ text, slug });
  }
  return entries;
}

export function withHeadingAnchors(content: string): string {
  const seen = new Map<string, number>();
  return content.replace(HEADING_PATTERN, (_full, rawText: string) => {
    const text = rawText.trim();
    let slug = slugify(text);
    const count = seen.get(slug) || 0;
    seen.set(slug, count + 1);
    if (count > 0) slug = `${slug}-${count}`;
    return `<h2 id="${slug}">${text}</h2>`;
  });
}

export function tocHref(slug: string): string {
  return `#${USER_CONTENT_PREFIX}${slug}`;
}
```

**Why the `user-content-` prefix:** `SafeMarkdown` sanitizes rendered HTML with `rehype-sanitize`'s default schema, which rewrites every `id` attribute to `user-content-<original-id>` to prevent DOM-clobbering (confirmed in `node_modules/hast-util-sanitize/lib/schema.js`, `clobberPrefix: 'user-content-'`). `withHeadingAnchors` emits the plain `id`; `tocHref` independently reconstructs the prefixed value the sanitizer will actually produce, so the two only need to agree on `slugify`.

- [ ] **Step 2: Write `app/blog/[slug]/page.tsx`**

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getAllPosts, getPostBySlug } from '../../../lib/blog';
import { extractToc, tocHref, withHeadingAnchors } from '../../../lib/blogToc';
import { SafeMarkdown } from '../../../components/ui/SafeMarkdown';
import { Badge } from '../../../components/ui/Badge';

export const dynamicParams = false;

export async function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return { title: 'Not Found' };
  }

  const url = `https://allmcps.com/blog/${post.slug}`;

  return {
    title: post.title,
    description: post.excerpt,
    keywords: [...post.tags, 'MCP', 'Model Context Protocol'].join(', '),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${post.title} | AllMCPs`,
      description: post.excerpt,
      url,
      type: 'article',
      publishedTime: `${post.date}T12:00:00.000Z`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${post.title} | AllMCPs`,
      description: post.excerpt,
    },
  };
}

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return (
      <main className="page-shell page-shell--status">
        <div className="page-shell-inner">
          <div className="surface page-panel">
            <div className="empty-state">
              <h1 className="empty-state-title">Post Not Found</h1>
              <p className="empty-state-body">This blog post may have been moved or the URL is incorrect.</p>
              <div className="empty-state-actions">
                <Link href="/blog" className="btn btn-primary">
                  ← Back to Blog
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const url = `https://allmcps.com/blog/${post.slug}`;
  const toc = extractToc(post.content);
  const contentWithAnchors = withHeadingAnchors(post.content);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.excerpt,
        url,
        datePublished: post.date,
        dateModified: post.date,
        keywords: post.tags.join(', '),
        author: {
          '@type': 'Organization',
          name: 'AllMCPs',
          url: 'https://allmcps.com',
        },
        publisher: {
          '@type': 'Organization',
          name: 'AllMCPs',
          url: 'https://allmcps.com',
          logo: {
            '@type': 'ImageObject',
            url: 'https://allmcps.com/logo-icon.svg',
          },
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': url,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://allmcps.com/blog' },
          { '@type': 'ListItem', position: 3, name: post.title, item: url },
        ],
      },
      ...(post.faq.length > 0
        ? [
            {
              '@type': 'FAQPage',
              mainEntity: post.faq.map((item) => ({
                '@type': 'Question',
                name: item.q,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: item.a,
                },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="page-shell page-shell--content">
        <div className="page-shell-inner">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumb">
              <li>
                <Link href="/">Home</Link>
              </li>
              <li className="breadcrumb-separator">
                <ChevronRight size={12} />
              </li>
              <li>
                <Link href="/blog">Blog</Link>
              </li>
              <li className="breadcrumb-separator">
                <ChevronRight size={12} />
              </li>
              <li className="breadcrumb-current">{post.title}</li>
            </ol>
          </nav>

          <article className="surface page-panel" style={{ marginTop: '1.5rem' }}>
            <header>
              <h1 className="text-page-title">{post.title}</h1>
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  marginBottom: '1rem',
                }}
              >
                <time dateTime={post.date} className="text-meta" style={{ fontWeight: 600 }}>
                  {formatDate(post.date)}
                </time>
                <span className="text-meta">· {post.readingTime} min read</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="category">
                    {tag}
                  </Badge>
                ))}
              </div>
            </header>

            {toc.length > 1 && (
              <nav
                aria-label="Table of contents"
                className="surface-muted"
                style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem' }}
              >
                <p className="text-meta" style={{ fontWeight: 700, marginBottom: '0.5rem' }}>
                  On this page
                </p>
                <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  {toc.map((entry) => (
                    <li key={entry.slug} style={{ marginBottom: '0.35rem' }}>
                      <a href={tocHref(entry.slug)}>{entry.text}</a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}

            <div className="markdown-body">
              <SafeMarkdown content={contentWithAnchors} />
            </div>

            {post.faq.length > 0 && (
              <div style={{ marginTop: '2.5rem' }}>
                <h2 className="text-section">Frequently asked questions</h2>
                {post.faq.map((item) => (
                  <div key={item.q} style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '1.05rem', marginBottom: '0.4rem' }}>
                      {item.q}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{item.a}</p>
                  </div>
                ))}
              </div>
            )}
          </article>

          <div style={{ marginTop: '2rem' }}>
            <Link href="/blog" className="btn btn-secondary">
              ← Back to Blog
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `lib/blogToc.ts` or `app/blog/[slug]/page.tsx`.

- [ ] **Step 4: Manual verification**

With `npm run dev` running:
`curl -s http://localhost:3000/blog/launching-allmcps`
Expected: HTML containing `<h1 class="text-page-title">Launching AllMCPs...`, at least one `<h2 id="` heading rewritten with a `user-content-` prefix (e.g. `id="user-content-what-mcp-is...`), a table-of-contents `<a href="#user-content-...">` link matching one of those ids, an `application/ld+json` script containing `"@type":"BlogPosting"` and `"@type":"FAQPage"`, and a rendered "Frequently asked questions" section with the four Q&A pairs from the frontmatter.
Also confirm `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/blog/does-not-exist` returns `404`.

- [ ] **Step 5: Commit**

```bash
git add lib/blogToc.ts "app/blog/[slug]/page.tsx"
git commit -m "$(cat <<'EOF'
Add blog post page with table of contents, FAQ, and JSON-LD

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: RSS feed

**Files:**
- Create: `app/blog/rss.xml/route.ts`

**Interfaces:**
- Consumes: `getAllPosts`, `BlogPost` from `lib/blog.ts` (Task 1).
- Produces: nothing consumed by other tasks (leaf route).

- [ ] **Step 1: Write `app/blog/rss.xml/route.ts`**

```ts
import { getAllPosts } from '../../../lib/blog';

export const dynamic = 'force-static';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const posts = getAllPosts();
  const siteUrl = 'https://allmcps.com';

  const items = posts
    .map((post) => {
      const url = `${siteUrl}/blog/${post.slug}`;
      const pubDate = new Date(`${post.date}T12:00:00.000Z`).toUTCString();
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(post.excerpt)}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
  <title>AllMCPs Blog</title>
  <link>${siteUrl}/blog</link>
  <description>News, guides, and updates from the AllMCPs team — MCP directory, agent tooling, and launch notes.</description>
${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `app/blog/rss.xml/route.ts`.

- [ ] **Step 3: Manual verification**

With `npm run dev` running:
`curl -s http://localhost:3000/blog/rss.xml`
Expected: well-formed XML starting with `<?xml version="1.0" encoding="UTF-8" ?>`, containing one `<item>` with `<title>Launching AllMCPs...` and `<link>https://allmcps.com/blog/launching-allmcps</link>`.

- [ ] **Step 4: Commit**

```bash
git add "app/blog/rss.xml/route.ts"
git commit -m "$(cat <<'EOF'
Add RSS feed for blog posts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Sitemap entries

**Files:**
- Modify: `app/sitemap.ts`

**Interfaces:**
- Consumes: `getAllPosts`, `BlogPost` from `lib/blog.ts` (Task 1).

- [ ] **Step 1: Add the import**

In `app/sitemap.ts`, add alongside the existing imports (after the `serversData` import):

```ts
import { getAllPosts } from '../lib/blog';
```

- [ ] **Step 2: Add blog entries before the return statement**

Insert this block immediately before `const serverEntries = servers.map(...)`, mirroring the existing try/catch fallback style already used for the D1 lookup earlier in the same function:

```ts
  let blogEntries: MetadataRoute.Sitemap = [];
  try {
    const posts = getAllPosts();
    blogEntries = posts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(`${post.date}T12:00:00.000Z`),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));
  } catch (e) {
    console.error('Failed to read blog posts for sitemap', e);
  }
```

- [ ] **Step 3: Include the new entries in the return value**

Change the final line of the function from:

```ts
  return [...sitemapEntries, ...serverEntries];
```

to:

```ts
  return [...sitemapEntries, ...blogEntries, ...serverEntries];
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `app/sitemap.ts`.

- [ ] **Step 5: Manual verification**

With `npm run dev` running:
`curl -s http://localhost:3000/sitemap.xml | grep "blog/launching-allmcps"`
Expected: one line containing `<loc>https://allmcps.com/blog/launching-allmcps</loc>`.

- [ ] **Step 6: Commit**

```bash
git add app/sitemap.ts
git commit -m "$(cat <<'EOF'
Add blog post URLs to sitemap.xml

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Document the convention in AGENTS.md

**Files:**
- Modify: `AGENTS.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Read the current file**

Read `AGENTS.md` to get its exact current content (it currently ends with the "Brand & Styling Rules" section).

- [ ] **Step 2: Append the new section**

Add this section to the end of `AGENTS.md`:

```markdown

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
```

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "$(cat <<'EOF'
Document the blog post convention in AGENTS.md

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Full build verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Run a full production build**

Run: `npm run build`
Expected: build completes successfully with no errors. In the route summary output, confirm `/blog`, `/blog/[slug]` (or the concrete `/blog/launching-allmcps`), and `/blog/rss.xml` are marked static (Next's build output uses `○`/`●` prerender markers, not `λ`/dynamic markers) — this is the concrete confirmation that the `force-static` / `dynamicParams = false` constraints from the Global Constraints section actually took effect and no blog route will attempt a filesystem read inside the deployed Worker.

- [ ] **Step 2: Spot-check the built output**

Run: `npm run start` (or reuse the already-running `npm run dev` server), then:
- `curl -s http://localhost:3000/blog` — confirm it lists the post, search input, and tag chip.
- `curl -s http://localhost:3000/blog/launching-allmcps` — confirm title, TOC, FAQ, and JSON-LD are all present (same checks as Task 3 Step 4).
- `curl -s http://localhost:3000/blog/rss.xml` — confirm valid RSS XML (same check as Task 4 Step 3).
- `curl -s http://localhost:3000/sitemap.xml | grep "blog/launching-allmcps"` — confirm the entry is present.
- Open `http://localhost:3000/blog/launching-allmcps` in a browser, click a table-of-contents link, and confirm the page scrolls to the matching heading (this is the one check that can only be done visually — it confirms the `user-content-` prefix handling in `lib/blogToc.ts` actually matches what `rehype-sanitize` produces at runtime).

- [ ] **Step 3: Paste the post's JSON-LD into a structured data validator (manual, outside this repo)**

Copy the contents of the `application/ld+json` script tag from `http://localhost:3000/blog/launching-allmcps` and check it parses as valid JSON with `node -e "JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'))"` (paste and Ctrl-D), or any JSON-LD/schema.org validator of your choice. Expected: valid JSON, no parse errors.

No commit for this task — it's verification only, confirming Tasks 1-6 integrate correctly.
