# Contributing to AllMCPs

Thanks for taking the time to contribute. This document covers how to get the
project running, what's expected of a change before it's merged, and the few
conventions that aren't obvious from the code.

## Adding or fixing a directory listing

**You don't need to touch this repo to add an MCP server.** Listings live in a
database, not in source control — submit yours at
[allmcps.com/submit](https://allmcps.com/submit), and claim an existing listing
from its page if you're the maintainer.

Open an issue instead if a listing is wrong in a way you can't fix through the
site: a dead repo link, a miscategorised server, or a listing that duplicates
another one.

## Getting set up

Requires **Node 22** (see `.nvmrc`).

```bash
npm install
npm run dev
```

The dev server runs at [localhost:3000](http://localhost:3000) with no
Cloudflare bindings, so data comes from the sample catalog in
`data/mcp-servers.json` (~113 listings across every category). That's enough to
work on essentially any page. Features that need real bindings — D1, R2,
Vectorize, Workers AI — degrade gracefully rather than crash.

For the full catalog locally, run `node scripts/seed.mjs`, which rebuilds
`data/mcp-servers.json` from the public source lists. Don't commit the result.

### Environment variables

Nothing is required for local development. Individual integrations (email,
payments, Turnstile, AI enrichment) read their own secrets at runtime and no-op
or fail gracefully when unset. If you're working on one of those, copy its keys
into a local `.dev.vars` file, which is gitignored. `docs/STRIPE_SETUP.md` and
`docs/SEQUENZY_SETUP.md` cover the two integrations with real setup steps.

## Before you open a pull request

Every change has to pass these, in order:

```bash
npm run typecheck   # tsc --noEmit, zero errors
npm run check       # Biome format + lint, writes fixes
npm test            # Vitest unit + regression suite
npm run build       # required if you touched routes, copy, content, or config
```

`npm run verify` runs the first three in one shot and is the minimum gate.

A few rules about how to get them passing:

- **Don't disable a lint rule, weaken a type, or skip a test to make a gate go
  green.** Fix the cause. If a rule is genuinely wrong for the codebase, say so
  in the PR and we'll change the rule deliberately.
- Biome reports warnings that don't block; errors do. Both are configured in
  `biome.json` on purpose.
- `npm run build` is what proves new pages and blog posts actually compile —
  they're statically generated, so a broken one won't surface until build time.

## Conventions worth knowing

**This is not the Next.js you may know.** The project tracks a newer release
with breaking API and convention changes. Read the bundled guides in
`node_modules/next/dist/docs/` before writing routing or rendering code, rather
than relying on what you remember from earlier versions. See
[AGENTS.md](./AGENTS.md).

**UI work follows [BRAND_GUIDE.md](./BRAND_GUIDE.md)** — colors, typography
(Atkinson Hyperlegible Next), and logo usage via `components/BrandLogo.tsx`.

**Blog posts** are one markdown file at `content/blog/YYYY-MM-DD-slug.md`. The
filename is the source of truth for date and slug; everything else — tags,
search, RSS, sitemap, structured data — is generated from the file. The
frontmatter schema is documented in [AGENTS.md](./AGENTS.md).

**Sitemap `lastmod` values are honest.** Static marketing pages carry a hand-
maintained ship date in `STATIC_PAGE_LASTMOD` (`lib/sitemapHelpers.ts`) rather
than `new Date()`, because rewriting every date on every request taught crawlers
to ignore the sitemap. Bump the date when you change real copy on one of those
pages; don't bump it for refactors or CSS-only tweaks. [AGENTS.md](./AGENTS.md)
has the full rule.

**Database changes** go through Drizzle. Edit `db/schema.ts`, then:

```bash
npm run db:generate       # writes a numbered migration into drizzle/
npm run db:migrate:local  # apply it to the local D1
```

Commit the generated migration, and don't add one-off data-fix SQL to the repo —
run those against D1 directly.

Two ledgers track migrations, and they have to stay in step:

- **wrangler's `d1_migrations` table** records what has actually been applied. It
  is the source of truth, and it keys off the `.sql` filenames in `drizzle/`.
- **`drizzle/meta/`** records what drizzle *believes* the schema is, and is what
  `db:generate` diffs against to produce the next migration.

They drifted once before: migrations `0034`–`0048` were hand-written and applied
through wrangler without being registered with drizzle, so `db:generate` started
emitting `CREATE TABLE` for tables that had existed for months.
`0050_drizzle_baseline.sql` re-synced them and explains the whole thing.

So: prefer `db:generate` over hand-writing, since that keeps both ledgers
aligned. If you do need to hand-write one (a rename, a data migration, anything
drizzle can't express), that's fine — but check afterwards that
`npm run db:generate` still reports **"No schema changes"**. If it wants to
recreate existing tables, the ledgers have drifted again and need re-baselining
the same way.

## Pull requests

- Branch off `main` and keep the change focused on one thing.
- Explain what the change does and why in the description; link an issue if one
  exists.
- Include the gate output, or just confirm `npm run verify` passed.
- Screenshots are welcome for anything visual.

## Reporting bugs and security issues

Open a [GitHub issue](https://github.com/Jackalope-Dev/all-mcps/issues) for
bugs, using one of the templates.

**Don't open a public issue for a security vulnerability.** See
[SECURITY.md](./SECURITY.md) for how to report one privately.
