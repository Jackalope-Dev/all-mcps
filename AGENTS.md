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
- You add a **new** static route that should appear in the core sitemap (guides, tools, client pages, trust, pricing, etc.): add a `STATIC_PAGE_LASTMOD` entry **and** a matching `staticEntry(...)` in the core shard of [`lib/sitemapShards.ts`](./lib/sitemapShards.ts) (if the page is not already generated from blog/categories/listings).
- You rename or retarget a path: remove the old key, add the new one.

**Do not bump for:**

- Pure refactors (imports, formatting, component renames with no user-visible copy change).
- CSS-only / layout-only tweaks that do not change content.
- Blog posts — lastmod comes from the post's `updated` (else `date`) front matter automatically.
- MCP listing pages — lastmod comes from the newest genuine content change
  (`aiDocAt` / `aiFaqAt` / `lastCommitAt`), falling back to `createdAt`.
  Deliberately **not** `lastCheckedAt` — the health cron rewrites that every
  ~15 min, which would make every listing look freshly updated on every crawl —
  nor `aiEnrichedAt` / `installExtractedAt`, which the ai-content queue stamps on
  claim even when nothing on the page changes. See `listingLastMod` in `lib/sitemapHelpers.ts`; the
  same value drives the visible "Last updated" row and JSON-LD `dateModified` on
  `/mcp/[id]`.

**Also keep in sync when adding a new evergreen guide or hub:**

1. `STATIC_PAGE_LASTMOD` + core sitemap entry (if applicable).
2. [`app/guides/page.tsx`](./app/guides/page.tsx) if it belongs on the Guides hub.
3. Footer / homepage chips for high-priority discovery pages. (The daily IndexNow
   cron pings a static page on its own once its `STATIC_PAGE_LASTMOD` date changes.)
4. Optionally [`app/llms.txt/route.ts`](./app/llms.txt/route.ts) under Useful Links.

# Blog Posts

**LopeBase writes and publishes every post** (property `all-mcps`: voice, keywords,
schedule, images and byline live in its content settings). Do not hand-write
posts or rebuild an in-repo generation pipeline; change the LopeBase settings.

How a post lands: LopeBase opens a pull request from a `lopebase/*` branch that adds,
edits or removes one `content/blog/<slug>.md`. [`.github/workflows/lopebase-posts.yml`](./.github/workflows/lopebase-posts.yml)
approves it and queues auto-merge, so it merges once CI passes and deploys with `main`.
A post that does not parse fails CI and never merges. Unpublishing in LopeBase removes the file.

Front matter (LopeBase's "markdown" format, read by [`lib/blog.ts`](./lib/blog.ts)):

```yaml
---
title: "Post title"
description: "One sentence: listing cards, meta description, RSS."
date: 2026-11-05            # publish day; future dates stay hidden until then
updated: 2026-11-20         # optional: last real edit, drives dateModified + sitemap lastmod
slug: "post-slug"           # matches the filename
tags: ["Building Servers", "mcp oauth"]
image: "https://..."        # optional: first image (also in the body); JSON-LD only
image_alt: "..."
faq: [{"q":"Question?","a":"Answer."}]   # optional, renders FAQ + FAQPage data
---
```

- Tags: tags matching `BLOG_TOPICS` in [`lib/blogTopics.ts`](./lib/blogTopics.ts) become the
  post's 1-2 topics (filter chips, OG label); others are meta keywords only. With no
  exact match, `postTopics` infers a topic from keyword cues.
- LopeBase also keeps the FAQ as a `## FAQ` section in the body; the loader strips it so
  the FAQ renders once.
- Body: `##` headings build the table of contents; keep heading text plain.
- Everything else (tag filters, search, RSS, sitemap entry, JSON-LD) is generated from
  the file. Posts are statically generated: they go live on the next deploy.

# Definition of Done

Run these in order. NEVER report a task complete, hand off, or call a change done
until every one passes cleanly:

1. `bun run typecheck` — `tsc --noEmit`, 0 errors.
2. `bun run check` — Biome format + lint (writes fixes). Must end clean with no
   remaining lint errors.
3. `bun run test` — Vitest unit + regression, all green.
4. `bun run knip` — no unused files, dependencies, or exports. Delete dead code
   instead of ignoring it; only add a `knip.jsonc` ignore for something loaded
   indirectly (runtime virtual modules, vendored contracts), with a comment saying why.
5. `bun run build` — required whenever routes, page copy, blog/content, sitemap
   entries, `STATIC_PAGE_LASTMOD`, config, or env wiring changed. Posts and static
   pages only go live on build, so this is how you confirm they compile.

`bun run verify` runs typecheck + lint + test + knip in one command (read-only lint);
that is the minimum gate before finishing. Use `bun run check` to auto-fix formatting/lint.

On failure: fix the cause and re-run the whole chain. Do this autonomously up to
5 times. Only after 5 failed attempts on the same gate do you stop and ask. Do not
disable a Biome rule, weaken a type, or skip a test to pass a gate. If a gate fails
in files you did not touch, a parallel session may be mid-flight — report it, do not
revert their work.


# Dev tooling

- Package manager: **bun** (`bun.lock`); Node (`.nvmrc`) is still the runtime for
  Next, OpenNext, Wrangler and Vitest. Use `bun run test`, never bare `bun test`
  (that is Bun's own test runner, not Vitest). `mcp-server/` is a separately
  published npm package with its own `package-lock.json`; use npm there.
- `bun run verify:quick` lints and tests only files changed against `origin/main`
  while iterating; `bun run verify` is still the gate.
- Lint warnings are ratcheted per rule (`lint-baseline.json`, checked by `bun run lint`).
  New warnings fail; after fixing some, run `bun run lint:ratchet:update`.
- Lefthook (installed by `bun install` via `prepare`): pre-commit runs Biome with
  `--write` on staged files only; pre-push runs `scripts/pre-push.mjs` plus a secret
  scan of the commits being pushed. The pre-push script lints the changed files, runs
  the typecheck and only the tests that import a changed file (at most 4 Vitest
  workers), and skips pushes that touch no code. One push's checks run at a time
  across the machine's repos. It is not the gate: `bun run verify` is, and CI runs it.
  Check by hand with `PRE_PUSH_BASE=origin/main node scripts/pre-push.mjs`.
- Biome is the formatter and linter. Format only files you touch; no repo-wide
  reformat commits (they collide with parallel sessions).
- Knip (`knip.jsonc`) finds dead files, exports, and dependencies. `scripts/` entries
  are one-off tools run by hand, so they count as entry points.
- CI (`.github/workflows/ci.yml`) runs the same chain plus an OpenNext build.
- Concurrent work goes in `.worktrees/<task>` (gitignored): see "Worktrees and keeping
  main current".

# Worktrees and keeping main current

- Start a task with `bun run worktree <task> [branch]` (`node scripts/worktree.mjs new`).
  It fast-forwards the local `main` to origin, adds `.worktrees/<task>` on a new branch
  from it, and copies the main checkout's small gitignored files (env files, generated
  `cloudflare-env.d.ts` / `next-env.d.ts`, manifests) that a fresh checkout lacks.
- Don't install in a worktree. It uses the main checkout's `node_modules`, because Node
  and bun resolve packages up the folder tree, and `new` has just synced the main
  checkout to the same lockfile. The script installs in the worktree only when the
  lockfiles differ. If your branch changes dependencies, install inside the worktree,
  never in the main checkout.
- Run tools through package scripts or `node scripts/run-bin.mjs <package>`, never
  a hard-coded `node_modules/...` path (missing in a worktree) or `npx` (it can pick up
  an unrelated global install or download a different version: on the dev box `npx
  biome` finds Biome 0.3.3).
- After you push to `main`, or a PR of yours merges, run `bun run sync` so the local
  `main` matches origin and the main checkout's `node_modules` match its lockfile. It only
  fast-forwards: it never resets, stashes or overwrites local edits, and says so when it
  leaves `main` alone.
- `bun run worktrees` lists worktrees; `--remove-merged` removes clean, merged ones.

# Deploys need the owner's go-ahead

Pushing or merging to `main` deploys to production. Direct pushes to `main` are welcome,
but only when the repository owner has approved that specific change in the current
session (for example "push it", "deploy it", "merge that").

- Without that approval: commit on a branch in `.worktrees/<task>`, push the branch,
  open a PR, and ask. Don't merge it yourself.
- An approval covers the change it was given for, not later ones, and never carries over
  to a new session or to another agent.
- The same rule covers deploy commands (`bun run deploy`, `bun run deploy:cf`, `wrangler deploy`), production
  database migrations or writes, and secret changes.
- With approval: run every gate first. Never `--no-verify`, force-push, or use admin
  rights to skip required checks.

# Committing

Agents commit their own work, on a branch, as the repo's configured git user:

- Work in `.worktrees/<task>` on a branch cut from the default branch. Commit or push
  to `main` directly only with the owner's approval (see "Deploys need the owner's
  go-ahead"); otherwise push the branch and open a PR.
- Commit when a coherent piece of work passes the Definition of Done. Conventional
  messages (`feat:`, `fix:`, `chore:`), body says why.
- No `Co-Authored-By` or other agent attribution trailers.
- Never force-push, `git reset --hard`, or `git clean` (they are denied in
  `.claude/settings.json`).
- Stage only files you changed for this task (`git add <paths>`, not `git add -A`)
  so parallel sessions' work stays out of your commit.

# Quick facts that trip people up

- `lib/backoffice/kit/` is vendored from jackalope-digital-hub `packages/admin-adapter`.
  Change it there and re-vendor; knip ignores it because its exports are the contract.
- `scripts/` are hand-run maintenance tools (`bunx tsx scripts/x.ts`), not app code.
- `cloudflare-env.d.ts` is generated by `bun run cf-typegen`; never hand-edit or commit churn in it.
- `custom-worker.ts` is the real Worker entry (wraps OpenNext); cron handlers live there.
- Knip cannot see `import('./x').Type` type queries; use `import type` instead.

# Workflow: parallel sessions

The user regularly runs multiple agents/sessions in parallel on generally
non-overlapping parts of this repo, and commits changes manually or via automation
outside the current session. `git status` / `git diff` at the start of a session may
show unrelated uncommitted changes you did not make. This is expected. Do not flag it
or ask about it. Proceed with your task and leave unrelated changes alone unless the
task requires touching those files.

Never delete or discard another session's uncommitted work (no `git checkout -- <file>`,
`git reset --hard`, `git clean`, an unpopped `git stash`, or overwriting a file
someone else is mid-edit on). If unrelated changes conflict with your work, work
around them: edit only the hunks you need, or ask how to proceed.