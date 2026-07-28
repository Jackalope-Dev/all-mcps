# Free MCP tools suite: Config Generator, Config Validator, Token Cost Calculator

## Goal

Add a `/tools` section of free, SEO-optimized utility pages targeting real MCP-niche search intent ("mcp config generator", "claude desktop config json", "mcp token cost") that don't yet have good free tooling elsewhere. Each tool should be genuinely useful standalone, and where possible link back into the existing directory (`/mcp/[id]`) to drive traffic into it.

Scope for this batch: **Config Generator**, **Config Validator**, **Token Cost Calculator**. (Config Merger and programmatic compare pages are good follow-ups, explicitly out of scope here.)

## Why this data shape forces a design choice

`lib/servers.ts` / `data/mcp-servers.json` / the `servers` D1 table only carry `id, name, url, description, category, ...` metadata — there is no structured `command`/`args`/`env`/`transport` field. Install instructions (e.g. `npx -y @foo/mcp`) are embedded as free text inside `description`, in inconsistent formats across ~thousands of entries. Any tool that claims to auto-generate a *working* config from directory data alone would silently be wrong some percentage of the time. Every design below treats directory data as a **prefill suggestion the user reviews/edits**, never as an autofilled fact presented as correct.

## Architecture

**Routes** (all new):
- `app/tools/page.tsx` — hub/landing page. Server component. Short intro + 3 cards linking to the subpages (styled like existing card patterns, e.g. `FeaturedCards.tsx`). Leaves room to add more tools later without restructuring.
- `app/tools/config-generator/page.tsx`
- `app/tools/config-validator/page.tsx`
- `app/tools/token-calculator/page.tsx`

Each subpage is a thin server component providing `Metadata` (title/description/canonical/OG, following the pattern in `app/page.tsx`) plus a ~150–300 word explanatory content block (what/why/how — for SEO substance, matching the long-form bias in `AGENTS.md`), and renders one `'use client'` component that holds the actual interactive tool.

**No new API routes.** Everything (JSON parsing, regex extraction, tokenizing) runs client-side in the browser. Nothing pasted by a user (configs, tool schemas) ever leaves the browser. Directory search reuses whatever data source `DirectoryGrid`/`/browse` already consumes (D1 with static-JSON fallback per `lib/servers.ts`), so there's no new backend surface to secure.

**Shared code, `lib/tools/`:**
- `configFormats.ts` — defines the 4 supported client config shapes and provides serialize (rows → JSON) / parse (JSON → rows + validation errors) functions used by both the Generator and the Validator:
  - Claude Desktop / Claude Code, Cursor, Windsurf: `{ "mcpServers": { "<name>": { "command": string, "args"?: string[], "env"?: Record<string,string> } } }` (or `{ "url": string }` for a remote/HTTP entry instead of `command`).
  - VS Code: top-level `"servers"` key, same per-entry shape, plus an optional `"type"` field (`"stdio" | "http"`).
- `parseInstallHint.ts` — regex-based best-effort extraction of an install command from a directory server's `description` text. Recognizes patterns like `npx -y <pkg>`, `npx <pkg>`, `uvx <pkg>`, `pip install <pkg>`, or a bare `https://` URL (treated as a remote/HTTP server). Returns `{ command, args } | { url } | null` — `null` means "couldn't parse," never a guess.
- `tokenize.ts` — thin wrapper around the new `gpt-tokenizer` dependency (pure JS, no WASM, browser-safe) exposing a `countTokens(text: string): number` function.

**New dependency:** `gpt-tokenizer` (npm).

## Tool 1: Config Generator (`/tools/config-generator`)

- Client component builds an in-memory list of server "rows": `{ id, name, command?, args?: string[], env?: Record<string,string>, url?, sourceServerId? }`.
- **Add from directory:** search/select input over the existing server list. On select, `parseInstallHint(description)` prefills an editable row; if parsing returns `null`, the row is prefilled with just the name and a visible link to `/mcp/[id]` so the user can look up the real install command themselves. `sourceServerId` is kept so the row can render an internal link back to its directory page (traffic hook).
- **Add custom:** blank form (name, command, args, env) for anything not in the directory or a local/custom server.
- Rows persist to `localStorage` (pure client convenience — no server round trip) so a refresh doesn't lose in-progress work.
- **Target format selector**: Claude Desktop/Code, Cursor, VS Code, Windsurf. Re-serializes the same row list into the selected client's exact JSON shape via `configFormats.ts`.
- Output: formatted JSON in a `<pre>` block + copy-to-clipboard button (feature-detect `navigator.clipboard`, fall back to a manual "select all" if unavailable) + a short note on the file path each client expects (e.g. `%APPDATA%\Claude\claude_desktop_config.json`, `~/Library/Application Support/Claude/claude_desktop_config.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, `~/.codeium/windsurf/mcp_config.json`).

## Tool 2: Config Validator (`/tools/config-validator`)

- Paste box for raw JSON + a format selector, auto-detected from the pasted JSON's top-level key (`mcpServers` vs `servers`) but user-overridable.
- On input (debounced), client-side checks:
  1. `JSON.parse` — on failure, show the parse error message and, where derivable, the approximate position.
  2. Structural validation against the selected format's shape from `configFormats.ts`: every entry needs a non-empty `command` or a `url`; `args` must be a string array if present; `env` must be a string-keyed object of strings; no duplicate server names.
  3. Findings rendered as a list of errors (blocking, red) vs warnings (advisory, yellow), each tagged with a JSON-path-like locator (e.g. `mcpServers.github.args[0]`).
- Clean input shows a "Looks good" success state.

## Tool 3: Token Cost Calculator (`/tools/token-calculator`)

Two tabs on one page:

- **Paste your tools JSON** (primary, accurate): textarea accepts either a raw `tools/list` JSON-RPC response (`{ result: { tools: [...] } }`) or a bare array of `{ name, description, inputSchema }`. Both shapes are detected and unwrapped. Each tool's name + description + stringified schema is passed through `tokenize.ts`; results show a total token count, a per-tool breakdown table, and a contextualizing line (e.g. "≈2% of a 200K context window") using a couple of well-known context sizes.
- **Quick estimate from directory** (secondary): same directory search/multi-select as the Generator. Applies a clearly-labeled rough average-tokens-per-server heuristic (a flat constant, not per-category — there's no data to justify finer granularity) with a running total. Each row links to `/mcp/[id]`. Explicit disclaimer text pointing to the "Paste your tools JSON" tab for a real number.

## SEO / nav / sitemap wiring

- **Metadata** on all 4 new pages targets its keyword, e.g.:
  - `/tools`: "Free MCP Tools — Config Generator, Validator & Token Calculator"
  - `/tools/config-generator`: "Free MCP Config Generator for Claude Desktop, Cursor & VS Code"
  - `/tools/config-validator`: "Free MCP Config Validator — Check Your mcpServers JSON"
  - `/tools/token-calculator`: "MCP Token Cost Calculator — Estimate Context Window Usage"
- **`components/SiteHeader.tsx`**: add `{ href: '/tools', label: 'Tools' }` to the `NAV` array (covers both desktop and mobile drawer, since mobile reuses `NAV`).
- **`components/SiteFooter.tsx`**: add a "Free Tools" column (or fold into "Resources") linking the 3 subpages.
- **`app/sitemap.ts`**: add `/tools` (priority 0.9, `changeFrequency: 'monthly'`, matching `/guide`/`/what-is-mcp`) and the 3 subpages (priority 0.8).
- **`app/llms.txt`**: append the new pages to the useful-links section.
- **Internal linking**: directory-sourced rows in the Generator, and the directory tab in the Token Calculator, link back to `/mcp/[id]` pages.

## Out of scope

- Config Merger, Uptime/Status Checker, programmatic Compare pages — explicitly deferred.
- No new API routes or server-side processing/logging of tool usage.
- No new automated test framework — none exists in this repo today; adding one is out of scope for this change.
- No live/remote fetching of real tool schemas from third-party MCP servers (the Token Calculator's accurate path is paste-your-own-JSON only).

## Testing

- `npm run build` to confirm all new pages/components compile and TypeScript passes.
- Manual QA in the dev server: valid/invalid inputs on all three tools, all 4 config-format outputs from the Generator round-trip cleanly through the Validator, copy-to-clipboard works, mobile layout of `/tools` and each subpage, `localStorage` persistence on the Generator, and page-source check of metadata/OG tags on all 4 new pages.
