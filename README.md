# AllMCPs

The definitive directory for discovering and installing [Model Context Protocol](https://modelcontextprotocol.io) (MCP) servers — _"Give your AI agents superpowers."_

AllMCPs is a [Next.js](https://nextjs.org) app deployed to Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare), backed by Cloudflare D1 (SQLite) through [Drizzle ORM](https://orm.drizzle.team). It catalogs thousands of MCP servers with search, category browsing, per-listing detail pages, a free browser-based tools suite, guides, and a blog.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). In local `next dev` there's no Cloudflare binding, so data loads from the bundled `data/mcp-servers.json` snapshot; in production the same code paths read from D1 and fall back to the snapshot on any error (see `lib/servers.ts`).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server. |
| `npm run build` | Production build (runs `scripts/build-blog-manifest.mjs` first via `prebuild`). |
| `npm run lint` | Run ESLint. |
| `npm run preview` | Build with OpenNext and preview the Workers bundle locally. |
| `npm run deploy` | Build and deploy to Cloudflare Workers. |
| `npm run cf-typegen` | Regenerate `cloudflare-env.d.ts` from `wrangler` bindings. |

## Project layout

- `app/` — App Router routes: directory (`/`, `/browse`, `/categories`), listing pages (`/mcp/[id]`), tools (`/tools/*`), guides, blog, submit/claim flows, dashboard/admin, and API routes under `app/api`.
- `components/` — Shared React components and UI primitives (`components/ui`).
- `lib/` — Data access and domain helpers. `lib/servers.ts` is the single source for fetching listings (D1 with JSON fallback + description normalization).
- `db/` + `drizzle/` — Drizzle schema and migrations.
- `content/blog/` — Markdown blog posts (`YYYY-MM-DD-slug.md`); see [AGENTS.md](./AGENTS.md) for the frontmatter schema.
- `mcp-server/` — The AllMCPs MCP server itself.

## Conventions

- **This is not the Next.js you may know** — it tracks a newer release with breaking changes. Read the bundled guides in `node_modules/next/dist/docs/` before writing routing/rendering code. See [AGENTS.md](./AGENTS.md).
- UI work must follow [BRAND_GUIDE.md](./BRAND_GUIDE.md) — colors, typography (Atkinson Hyperlegible Next), and logo usage via `components/BrandLogo.tsx`.
