# Free MCP Tools Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `/tools` section with three free, client-side MCP utilities — Config Generator, Config Validator, and Token Cost Calculator — each SEO-optimized and cross-linked into the existing directory.

**Architecture:** Pure client-side React components (no new API routes) under `components/tools/`, consumed by thin server-component pages under `app/tools/`. Shared logic (config format serialize/validate, install-hint parsing, tokenizing) lives in `lib/tools/`. Directory search reuses the existing public `/api/v1/search` endpoint via `fetch` rather than shipping the ~1.4MB server dataset to the client.

**Tech Stack:** Next.js App Router (existing), React client components, new dependency `gpt-tokenizer` for token counting.

## Global Constraints

- No new API routes — all parsing/tokenizing/validation runs in the browser (per spec).
- No new automated test framework — this repo has none today; verification is `npx tsc --noEmit` for logic modules plus manual dev-server QA for UI (per spec, "out of scope").
- Directory data used for prefill is always a **suggestion the user can edit**, never presented as a guaranteed-correct fact — `parseInstallHint` returns `null` when it can't confidently parse a command, and callers must handle that case by leaving the row blank + linking to the directory listing.
- Follow `BRAND_GUIDE.md` (dark theme, cyan/blue accent, existing `Card`/`Button`/`Badge`/`Input` components) and existing page patterns (`page-shell page-shell--content` / `page-shell-inner` / `surface page-panel` / `text-page-title` / `text-lead` / `text-section`) — do not invent new layout primitives.
- Do not commit — the user is handling commits on this branch themselves, and other agents may have work in progress on shared files (`SiteHeader.tsx`, `SiteFooter.tsx`, `app/sitemap.ts`, `app/llms.txt/route.ts`). Before editing any shared file in Task 9, re-read it fresh (don't trust an earlier read from this plan) and make the smallest possible diff.

---

### Task 1: Token counting utility

**Files:**
- Modify: `package.json` (add `gpt-tokenizer` dependency)
- Create: `lib/tools/tokenize.ts`

**Interfaces:**
- Produces: `countTokens(text: string): number`; `interface ToolSchema { name: string; description?: string; inputSchema?: unknown }`; `extractTools(parsed: unknown): ToolSchema[]`; `interface ToolTokenBreakdown { name: string; tokens: number }`; `computeToolTokens(tools: ToolSchema[]): { breakdown: ToolTokenBreakdown[]; total: number }`.

- [ ] **Step 1: Install the dependency**

Run: `npm install gpt-tokenizer`

- [ ] **Step 2: Create `lib/tools/tokenize.ts`**

```ts
import { encode } from 'gpt-tokenizer';

/** Approximate token count using a GPT-4-class tokenizer. Callers must present this as an estimate, not an exact count for every model. */
export function countTokens(text: string): number {
  if (!text) return 0;
  return encode(text).length;
}

export interface ToolSchema {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

/** Accepts a raw tools/list JSON-RPC response, a {tools:[...]} object, or a bare array of tool schemas. */
export function extractTools(parsed: unknown): ToolSchema[] {
  if (Array.isArray(parsed)) {
    return parsed.filter(
      (t): t is ToolSchema => !!t && typeof t === 'object' && typeof (t as Record<string, unknown>).name === 'string'
    );
  }
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.tools)) return extractTools(obj.tools);
    if (obj.result && typeof obj.result === 'object') {
      return extractTools((obj.result as Record<string, unknown>).tools);
    }
  }
  return [];
}

export interface ToolTokenBreakdown {
  name: string;
  tokens: number;
}

export function computeToolTokens(tools: ToolSchema[]): { breakdown: ToolTokenBreakdown[]; total: number } {
  const breakdown = tools.map((tool) => {
    const serialized = JSON.stringify({
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema || {},
    });
    return { name: tool.name, tokens: countTokens(serialized) };
  });
  const total = breakdown.reduce((sum, t) => sum + t.tokens, 0);
  return { breakdown, total };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `lib/tools/tokenize.ts`.

- [ ] **Step 4: Manual sanity check**

Temporarily add `console.log(countTokens('hello world'))` at the bottom of the file, run `node --experimental-strip-types -e "require('./lib/tools/tokenize.ts')"` — if that fails (no ESM loader for `.ts` outside Next's build), instead verify by importing `countTokens` from a throwaway line in `app/tools/token-calculator/page.tsx` once Task 7 exists and checking the browser console shows a small positive integer (e.g. 2-3) for `"hello world"`. Remove the temporary log before moving on. Confirm `extractTools` and `computeToolTokens` visually match the shapes described above by re-reading the file once more.

---

### Task 2: Config format serialize/validate utility

**Files:**
- Create: `lib/tools/configFormats.ts`

**Interfaces:**
- Produces: `type ClientFormat = 'claude' | 'cursor' | 'windsurf' | 'vscode'`; `interface ServerRow { id: string; name: string; command?: string; args?: string[]; env?: Record<string,string>; url?: string; sourceServerId?: string }`; `interface ConfigFinding { level: 'error' | 'warning'; path: string; message: string }`; `CLIENT_FORMAT_LABELS: Record<ClientFormat,string>`; `CLIENT_CONFIG_PATHS: Record<ClientFormat,string[]>`; `serializeConfig(rows: ServerRow[], format: ClientFormat): string`; `detectFormat(parsed: unknown): ClientFormat`; `validateConfig(parsed: unknown, format: ClientFormat): ConfigFinding[]`.

- [ ] **Step 1: Create `lib/tools/configFormats.ts`**

```ts
export type ClientFormat = 'claude' | 'cursor' | 'windsurf' | 'vscode';

export interface ServerRow {
  /** Client-side row id (crypto.randomUUID()), not a directory id. */
  id: string;
  /** The key this server is registered under in the config (e.g. mcpServers.<name>). */
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  /** Remote/HTTP server URL — mutually exclusive with command/args in practice. */
  url?: string;
  /** Set when this row was added via the directory picker, for the "view listing" link. */
  sourceServerId?: string;
}

export interface ConfigFinding {
  level: 'error' | 'warning';
  path: string;
  message: string;
}

export const CLIENT_FORMAT_LABELS: Record<ClientFormat, string> = {
  claude: 'Claude Desktop / Claude Code',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
  vscode: 'VS Code',
};

export const CLIENT_CONFIG_PATHS: Record<ClientFormat, string[]> = {
  claude: [
    'macOS: ~/Library/Application Support/Claude/claude_desktop_config.json',
    'Windows: %APPDATA%\\Claude\\claude_desktop_config.json',
  ],
  cursor: ['.cursor/mcp.json (project) or ~/.cursor/mcp.json (global)'],
  windsurf: ['~/.codeium/windsurf/mcp_config.json'],
  vscode: ['.vscode/mcp.json (workspace) or user settings.json under "mcp"'],
};

function rowToServerEntry(row: ServerRow): Record<string, unknown> {
  if (row.url) {
    return row.env && Object.keys(row.env).length ? { url: row.url, env: row.env } : { url: row.url };
  }
  const entry: Record<string, unknown> = { command: row.command || '' };
  if (row.args && row.args.length) entry.args = row.args;
  if (row.env && Object.keys(row.env).length) entry.env = row.env;
  return entry;
}

export function serializeConfig(rows: ServerRow[], format: ClientFormat): string {
  const entries: Record<string, unknown> = {};
  for (const row of rows) {
    if (!row.name) continue;
    entries[row.name] = rowToServerEntry(row);
  }
  const key = format === 'vscode' ? 'servers' : 'mcpServers';
  return JSON.stringify({ [key]: entries }, null, 2);
}

export function detectFormat(parsed: unknown): ClientFormat {
  if (parsed && typeof parsed === 'object' && 'servers' in (parsed as Record<string, unknown>)) {
    return 'vscode';
  }
  return 'claude';
}

export function validateConfig(parsed: unknown, format: ClientFormat): ConfigFinding[] {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return [{ level: 'error', path: '$', message: 'Top-level value must be a JSON object.' }];
  }

  const key = format === 'vscode' ? 'servers' : 'mcpServers';
  const container = (parsed as Record<string, unknown>)[key];

  if (container === undefined) {
    return [{ level: 'error', path: '$', message: `Missing top-level "${key}" key for this client format.` }];
  }
  if (typeof container !== 'object' || container === null || Array.isArray(container)) {
    return [{ level: 'error', path: `$.${key}`, message: `"${key}" must be an object mapping server names to their config.` }];
  }

  const findings: ConfigFinding[] = [];

  for (const [name, value] of Object.entries(container as Record<string, unknown>)) {
    const path = `${key}.${name}`;

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      findings.push({ level: 'error', path, message: 'Server entry must be an object.' });
      continue;
    }
    const entry = value as Record<string, unknown>;
    const hasCommand = typeof entry.command === 'string' && entry.command.trim().length > 0;
    const hasUrl = typeof entry.url === 'string' && entry.url.trim().length > 0;

    if (!hasCommand && !hasUrl) {
      findings.push({ level: 'error', path, message: 'Entry needs a non-empty "command" or "url".' });
    }
    if (hasCommand && hasUrl) {
      findings.push({ level: 'warning', path, message: 'Entry has both "command" and "url" — only one transport is normally used.' });
    }
    if ('args' in entry) {
      const args = entry.args;
      if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) {
        findings.push({ level: 'error', path: `${path}.args`, message: '"args" must be an array of strings.' });
      }
    }
    if ('env' in entry) {
      const env = entry.env;
      if (typeof env !== 'object' || env === null || Array.isArray(env)) {
        findings.push({ level: 'error', path: `${path}.env`, message: '"env" must be an object of string values.' });
      } else if (Object.values(env as Record<string, unknown>).some((v) => typeof v !== 'string')) {
        findings.push({ level: 'error', path: `${path}.env`, message: 'All "env" values must be strings.' });
      }
    }
  }

  return findings;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `lib/tools/configFormats.ts`.

- [ ] **Step 3: Manual round-trip check (deferred to Task 6)**

There's no test runner in this repo, so round-trip correctness (`serializeConfig` output passes `validateConfig` with zero findings, and a config with a missing `command` produces exactly one error) is verified interactively once the Validator UI exists in Task 6 — paste the output of the Generator (Task 5) into the Validator and confirm it shows "Looks good."

---

### Task 3: Best-effort install-hint parser

**Files:**
- Create: `lib/tools/parseInstallHint.ts`

**Interfaces:**
- Produces: `interface InstallHint { command: string; args: string[] }`; `interface RemoteHint { url: string }`; `type ParsedInstallHint = InstallHint | RemoteHint | null`; `parseInstallHint(description: string): ParsedInstallHint`; `isRemoteHint(hint: ParsedInstallHint): hint is RemoteHint`.

- [ ] **Step 1: Create `lib/tools/parseInstallHint.ts`**

```ts
export interface InstallHint {
  command: string;
  args: string[];
}

export interface RemoteHint {
  url: string;
}

export type ParsedInstallHint = InstallHint | RemoteHint | null;

const RUNNER_PATTERN = /\b(npx|uvx|bunx)\s+(-y\s+)?([@a-zA-Z0-9._/-]+)/;
const PIP_PATTERN = /\bpip install\s+([a-zA-Z0-9._-]+)/;
const URL_PATTERN = /https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/;

/** Hosts that show up in descriptions as badges/repo links, not as the server's own remote endpoint. */
const NON_ENDPOINT_HOSTS = ['glama.ai', 'github.com', 'npmjs.com', 'pypi.org'];

/**
 * Best-effort extraction of an install command from a directory server's free-text
 * description. Returns null when nothing recognizable is found — callers must treat
 * that as "ask the user," never fall back to a guess.
 */
export function parseInstallHint(description: string): ParsedInstallHint {
  if (!description) return null;

  const runnerMatch = description.match(RUNNER_PATTERN);
  if (runnerMatch) {
    const [, runner, , pkg] = runnerMatch;
    const args = runner === 'npx' ? ['-y', pkg] : [pkg];
    return { command: runner, args };
  }

  const pipMatch = description.match(PIP_PATTERN);
  if (pipMatch) {
    return { command: 'pip', args: ['install', pipMatch[1]] };
  }

  const urlMatch = description.match(URL_PATTERN);
  if (urlMatch) {
    const candidate = urlMatch[0].replace(/[).,]+$/, '');
    const isNonEndpoint = NON_ENDPOINT_HOSTS.some((host) => candidate.includes(host));
    if (!isNonEndpoint) {
      return { url: candidate };
    }
  }

  return null;
}

export function isRemoteHint(hint: ParsedInstallHint): hint is RemoteHint {
  return !!hint && 'url' in hint;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `lib/tools/parseInstallHint.ts`.

- [ ] **Step 3: Manual verification against real directory data**

Run this ad-hoc check (uses only built-in Node, no ts-node needed — copy the regexes inline):

```bash
node -e "
const RUNNER = /\b(npx|uvx|bunx)\s+(-y\s+)?([@a-zA-Z0-9._/-]+)/;
const data = require('./data/mcp-servers.json');
let hits = 0;
for (const s of data.slice(0, 200)) {
  if (RUNNER.test(s.description)) hits++;
}
console.log(hits, '/ 200 sampled descriptions matched the npx/uvx/bunx pattern');
"
```

Expected: a nonzero hit count (the sample descriptions read earlier in this project show `npx -y @scope/pkg` is common), confirming the pattern isn't over- or under-matching against real data. This is a sanity check, not a full test suite — move on once the count looks reasonable (double digits or higher out of 200).

---

### Task 4: Shared directory search component

**Files:**
- Create: `components/tools/ServerPicker.tsx`

**Interfaces:**
- Consumes: existing `GET /api/v1/search?q=&limit=` endpoint (`app/api/v1/search/route.ts`), which returns `{ servers: Array<{ id, name, description, category, url, isOfficial, isVerifiedActive, upvotes, installName, claudeConfigSnippet, detailUrl, markdownUrl }> }`.
- Produces: `interface DirectoryServerHit { id: string; name: string; description: string; category: string }`; `ServerPicker({ onSelect, placeholder? }: { onSelect: (server: DirectoryServerHit) => void; placeholder?: string })`.

- [ ] **Step 1: Create `components/tools/ServerPicker.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';

export interface DirectoryServerHit {
  id: string;
  name: string;
  description: string;
  category: string;
}

export function ServerPicker({
  onSelect,
  placeholder = 'Search the directory…',
}: {
  onSelect: (server: DirectoryServerHit) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DirectoryServerHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/v1/search?q=${encodeURIComponent(query)}&limit=8`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => setResults(data.servers || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div style={{ position: 'relative' }}>
      <Input
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search MCP directory"
      />
      {loading && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Searching…</div>
      )}
      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
          {results.map((server) => (
            <Card
              key={server.id}
              hoverable
              onClick={() => {
                onSelect(server);
                setQuery('');
                setResults([]);
              }}
              style={{ padding: '0.75rem 1rem', cursor: 'pointer' }}
            >
              <strong style={{ display: 'block' }}>{server.name}</strong>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{server.category}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `components/tools/ServerPicker.tsx`.

- [ ] **Step 3: Manual verification (deferred)**

`ServerPicker` has no page to render on yet — it's exercised directly in Tasks 5 and 7. No separate step needed here.

---

### Task 5: Config Generator tool + page

**Files:**
- Create: `components/tools/ConfigGeneratorTool.tsx`
- Create: `app/tools/config-generator/page.tsx`

**Interfaces:**
- Consumes: `ServerPicker`/`DirectoryServerHit` (Task 4), `parseInstallHint`/`isRemoteHint` (Task 3), `ClientFormat`/`ServerRow`/`CLIENT_FORMAT_LABELS`/`CLIENT_CONFIG_PATHS`/`serializeConfig` (Task 2).
- Produces: `ConfigGeneratorTool()` component, default-exported `/tools/config-generator` page.

- [ ] **Step 1: Create `components/tools/ConfigGeneratorTool.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ServerPicker, DirectoryServerHit } from './ServerPicker';
import { parseInstallHint, isRemoteHint } from '../../lib/tools/parseInstallHint';
import {
  ClientFormat,
  ServerRow,
  CLIENT_FORMAT_LABELS,
  CLIENT_CONFIG_PATHS,
  serializeConfig,
} from '../../lib/tools/configFormats';

const STORAGE_KEY = 'allmcps-config-generator-rows';

function newRow(partial: Partial<ServerRow> = {}): ServerRow {
  return { id: crypto.randomUUID(), name: '', command: '', args: [], env: {}, ...partial };
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function ConfigGeneratorTool() {
  const [rows, setRows] = useState<ServerRow[]>([]);
  const [format, setFormat] = useState<ClientFormat>('claude');
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setRows(JSON.parse(saved));
    } catch {
      // localStorage unavailable or corrupt — start with an empty list.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {
      // Storage full/blocked — the in-memory list still works for this session.
    }
  }, [rows, hydrated]);

  function addFromDirectory(server: DirectoryServerHit) {
    const hint = parseInstallHint(server.description);
    const name = slugify(server.name);
    if (hint && isRemoteHint(hint)) {
      setRows((r) => [...r, newRow({ name, url: hint.url, sourceServerId: server.id })]);
    } else if (hint) {
      setRows((r) => [...r, newRow({ name, command: hint.command, args: hint.args, sourceServerId: server.id })]);
    } else {
      setRows((r) => [...r, newRow({ name, sourceServerId: server.id })]);
    }
  }

  function updateRow(id: string, patch: Partial<ServerRow>) {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    setRows((r) => r.filter((row) => row.id !== id));
  }

  function parseEnvInput(value: string): Record<string, string> {
    const env: Record<string, string> = {};
    value.split(',').forEach((pair) => {
      const [k, ...rest] = pair.trim().split('=');
      if (k) env[k] = rest.join('=');
    });
    return env;
  }

  const configJson = serializeConfig(rows, format);

  async function copyConfig() {
    try {
      await navigator.clipboard.writeText(configJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable/blocked — the <pre> text below is still selectable manually.
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <section>
        <h2 className="text-section" style={{ marginBottom: '1rem' }}>1. Add servers</h2>
        <div style={{ marginBottom: '1rem' }}>
          <ServerPicker onSelect={addFromDirectory} />
        </div>
        <Button variant="secondary" size="sm" onClick={() => setRows((r) => [...r, newRow()])}>
          + Add custom server
        </Button>
      </section>

      {rows.length > 0 && (
        <section>
          <h2 className="text-section" style={{ marginBottom: '1rem' }}>2. Review &amp; edit</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {rows.map((row) => (
              <Card key={row.id} style={{ padding: '1.25rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.75rem',
                  }}
                >
                  {row.sourceServerId ? (
                    <a
                      href={`/mcp/${row.sourceServerId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.8rem', color: 'var(--accent-color)' }}
                    >
                      View directory listing ↗
                    </a>
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={() => removeRow(row.id)}
                    aria-label="Remove server"
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
                <Input
                  label="Server name (config key)"
                  value={row.name}
                  onChange={(e) => updateRow(row.id, { name: e.target.value })}
                />
                <Input
                  label="Command"
                  placeholder="npx"
                  value={row.command || ''}
                  onChange={(e) => updateRow(row.id, { command: e.target.value })}
                  disabled={!!row.url}
                />
                <Input
                  label="Args (space-separated)"
                  placeholder="-y @scope/package"
                  value={(row.args || []).join(' ')}
                  onChange={(e) => updateRow(row.id, { args: e.target.value.split(' ').filter(Boolean) })}
                  disabled={!!row.url}
                />
                <Input
                  label="Remote URL (leave blank for a local/stdio server)"
                  placeholder="https://example.com/mcp"
                  value={row.url || ''}
                  onChange={(e) => updateRow(row.id, { url: e.target.value })}
                />
                <Input
                  label="Env vars (KEY=value, comma-separated)"
                  placeholder="API_KEY=xxx, OTHER=yyy"
                  value={Object.entries(row.env || {}).map(([k, v]) => `${k}=${v}`).join(', ')}
                  onChange={(e) => updateRow(row.id, { env: parseEnvInput(e.target.value) })}
                />
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-section" style={{ marginBottom: '1rem' }}>3. Choose your client &amp; copy</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {(Object.keys(CLIENT_FORMAT_LABELS) as ClientFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`btn btn-sm ${format === f ? 'btn-primary' : 'btn-secondary'}`}
            >
              {CLIENT_FORMAT_LABELS[f]}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          Paste into: {CLIENT_CONFIG_PATHS[format].join(' · ')}
        </p>
        <div style={{ position: 'relative' }}>
          <pre
            style={{
              background: 'rgba(0,0,0,0.4)',
              padding: '1.5rem',
              borderRadius: '8px',
              overflowX: 'auto',
              border: '1px solid var(--border-color)',
              fontSize: '0.85rem',
              margin: 0,
            }}
          >
            {configJson}
          </pre>
          <Button size="sm" onClick={copyConfig} style={{ position: 'absolute', top: '0.75rem', right: '0.75rem' }}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/tools/config-generator/page.tsx`**

```tsx
import { Metadata } from 'next';
import { ConfigGeneratorTool } from '../../../components/tools/ConfigGeneratorTool';

export const metadata: Metadata = {
  title: 'Free MCP Config Generator for Claude Desktop, Cursor & VS Code',
  description:
    'Generate a ready-to-paste claude_desktop_config.json, .cursor/mcp.json, or VS Code MCP config from any server in the AllMCPs directory or your own custom setup.',
  alternates: { canonical: 'https://allmcps.com/tools/config-generator' },
  openGraph: {
    title: 'Free MCP Config Generator | AllMCPs',
    description:
      'Generate a ready-to-paste MCP client config for Claude Desktop, Cursor, VS Code, or Windsurf.',
    url: 'https://allmcps.com/tools/config-generator',
  },
};

export default function ConfigGeneratorPage() {
  return (
    <main className="page-shell page-shell--content">
      <div className="page-shell-inner">
        <div className="surface page-panel">
          <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>MCP Config Generator</h1>
          <p className="text-lead" style={{ marginBottom: '2rem' }}>
            Pick servers from the AllMCPs directory or add your own, then generate a ready-to-paste config
            for Claude Desktop, Claude Code, Cursor, VS Code, or Windsurf.
          </p>

          <ConfigGeneratorTool />

          <div style={{ marginTop: '3rem', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              How MCP client configs work
            </h2>
            <p style={{ marginBottom: '1rem' }}>
              Every MCP-compatible AI client &mdash; Claude Desktop, Claude Code, Cursor, VS Code, and Windsurf &mdash;
              reads a JSON file listing the MCP servers it should launch on startup. Each entry names a server and
              tells the client how to run it: a local command (like <code>npx -y some-package</code>) plus any
              arguments and environment variables it needs, or a URL if the server runs remotely over HTTP instead
              of as a local subprocess. The exact file name and top-level JSON key differ slightly by client, which
              is why copy-pasting a snippet from one client's docs into another's config file often silently fails.
            </p>
            <p>
              This generator lets you search the AllMCPs directory for a server, auto-fills a best-effort install
              command parsed from its listing (always double-check package names before saving &mdash; server
              descriptions aren't perfectly standardized), or lets you add a custom entry by hand. Pick your target
              client above and copy the result straight into the config file at the path shown.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing either new file.

- [ ] **Step 4: Manual QA in the dev server**

Run: `npm run dev`, visit `http://localhost:3000/tools/config-generator`, then:
1. Search the directory box for a term you know exists (e.g. a category keyword like "finance"), confirm results appear and clicking one adds a row.
2. Confirm a row added from a server whose description contains an `npx -y <pkg>` pattern prefills `command`/`args` correctly.
3. Click "+ Add custom server", fill in a command/args/env manually.
4. Switch between all 4 client-format buttons and confirm the JSON output's top-level key changes (`mcpServers` vs `servers`) and stays valid JSON.
5. Click "Copy", confirm the button flashes "Copied!" and the clipboard actually contains the JSON (paste it somewhere to check).
6. Refresh the page and confirm the rows you added are still there (localStorage persistence).

---

### Task 6: Config Validator tool + page

**Files:**
- Create: `components/tools/ConfigValidatorTool.tsx`
- Create: `app/tools/config-validator/page.tsx`

**Interfaces:**
- Consumes: `ClientFormat`/`CLIENT_FORMAT_LABELS`/`detectFormat`/`validateConfig` (Task 2).
- Produces: `ConfigValidatorTool()` component, default-exported `/tools/config-validator` page.

- [ ] **Step 1: Create `components/tools/ConfigValidatorTool.tsx`**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { Badge } from '../ui/Badge';
import {
  ClientFormat,
  CLIENT_FORMAT_LABELS,
  detectFormat,
  validateConfig,
} from '../../lib/tools/configFormats';

export function ConfigValidatorTool() {
  const [raw, setRaw] = useState('');
  const [formatOverride, setFormatOverride] = useState<ClientFormat | 'auto'>('auto');

  const { findings, parseError, effectiveFormat } = useMemo(() => {
    if (!raw.trim()) {
      return { findings: [], parseError: null as string | null, effectiveFormat: 'claude' as ClientFormat };
    }
    try {
      const parsed = JSON.parse(raw);
      const format = formatOverride === 'auto' ? detectFormat(parsed) : formatOverride;
      return { findings: validateConfig(parsed, format), parseError: null as string | null, effectiveFormat: format };
    } catch (err) {
      return { findings: [], parseError: (err as Error).message, effectiveFormat: 'claude' as ClientFormat };
    }
  }, [raw, formatOverride]);

  const errors = findings.filter((f) => f.level === 'error');
  const warnings = findings.filter((f) => f.level === 'warning');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setFormatOverride('auto')}
          className={`btn btn-sm ${formatOverride === 'auto' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Auto-detect
        </button>
        {(Object.keys(CLIENT_FORMAT_LABELS) as ClientFormat[]).map((f) => (
          <button
            key={f}
            onClick={() => setFormatOverride(f)}
            className={`btn btn-sm ${formatOverride === f ? 'btn-primary' : 'btn-secondary'}`}
          >
            {CLIENT_FORMAT_LABELS[f]}
          </button>
        ))}
      </div>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={'{\n  "mcpServers": {\n    "example": {\n      "command": "npx",\n      "args": ["-y", "@example/mcp-server"]\n    }\n  }\n}'}
        rows={16}
        className="form-input"
        style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
        aria-label="Paste your MCP config JSON"
      />

      {raw.trim() && (
        <div>
          {parseError ? (
            <div className="surface-muted" style={{ padding: '1rem', borderLeft: '3px solid #ef4444' }}>
              <strong>Invalid JSON:</strong> {parseError}
            </div>
          ) : errors.length === 0 && warnings.length === 0 ? (
            <div className="surface-muted" style={{ padding: '1rem', borderLeft: '3px solid #10b981' }}>
              ✓ Looks good &mdash; valid {CLIENT_FORMAT_LABELS[effectiveFormat]} config.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {errors.map((f, i) => (
                <div
                  key={`e${i}`}
                  className="surface-muted"
                  style={{ padding: '0.75rem 1rem', borderLeft: '3px solid #ef4444' }}
                >
                  <Badge variant="default" style={{ marginRight: '0.5rem' }}>error</Badge>
                  <code>{f.path}</code> &mdash; {f.message}
                </div>
              ))}
              {warnings.map((f, i) => (
                <div
                  key={`w${i}`}
                  className="surface-muted"
                  style={{ padding: '0.75rem 1rem', borderLeft: '3px solid #f59e0b' }}
                >
                  <Badge variant="default" style={{ marginRight: '0.5rem' }}>warning</Badge>
                  <code>{f.path}</code> &mdash; {f.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `app/tools/config-validator/page.tsx`**

```tsx
import { Metadata } from 'next';
import { ConfigValidatorTool } from '../../../components/tools/ConfigValidatorTool';

export const metadata: Metadata = {
  title: 'Free MCP Config Validator — Check Your mcpServers JSON',
  description:
    'Paste your Claude Desktop, Cursor, VS Code, or Windsurf MCP config and catch JSON syntax errors and missing fields before you restart your client.',
  alternates: { canonical: 'https://allmcps.com/tools/config-validator' },
  openGraph: {
    title: 'Free MCP Config Validator | AllMCPs',
    description:
      'Paste your MCP config JSON and catch errors before you restart your client.',
    url: 'https://allmcps.com/tools/config-validator',
  },
};

export default function ConfigValidatorPage() {
  return (
    <main className="page-shell page-shell--content">
      <div className="page-shell-inner">
        <div className="surface page-panel">
          <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>MCP Config Validator</h1>
          <p className="text-lead" style={{ marginBottom: '2rem' }}>
            Paste your <code>mcpServers</code> (or VS Code <code>servers</code>) JSON below to catch mistakes
            before your AI client silently fails to load a server.
          </p>

          <ConfigValidatorTool />

          <div style={{ marginTop: '3rem', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Why validate before restarting your client
            </h2>
            <p style={{ marginBottom: '1rem' }}>
              A single misplaced comma or a missing <code>command</code> field is enough to make an MCP client
              quietly skip a server on startup, usually with no error message pointing at the actual cause.
              Tracking that down by trial and error &mdash; edit, save, fully restart the client, check if it
              worked &mdash; is slow.
            </p>
            <p>
              This tool checks your pasted JSON against the shape each supported client expects: valid JSON syntax,
              a non-empty <code>command</code> or <code>url</code> on every entry, and correctly typed{' '}
              <code>args</code> and <code>env</code> fields. Everything runs in your browser &mdash; nothing you
              paste here is sent anywhere, which matters since configs often contain API keys and other secrets in
              their <code>env</code> blocks.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing either new file.

- [ ] **Step 4: Manual QA in the dev server, including the Task 2 round-trip check**

Run: `npm run dev`, visit `http://localhost:3000/tools/config-validator`, then:
1. Paste invalid JSON (e.g. drop a trailing comma) and confirm a clear parse-error message appears.
2. Paste a config missing `command` on one entry and confirm exactly one error appears at the right path.
3. Paste a config where one entry has both `command` and `url` set and confirm the warning appears.
4. Paste a fully valid config and confirm the green "Looks good" state.
5. Open `/tools/config-generator` in another tab, build a small config, copy it, paste it here, and confirm it validates cleanly — this closes the loop from Task 2's deferred round-trip check.

---

### Task 7: Token Cost Calculator tool + page

**Files:**
- Create: `components/tools/TokenCalculatorTool.tsx`
- Create: `app/tools/token-calculator/page.tsx`

**Interfaces:**
- Consumes: `extractTools`/`computeToolTokens` (Task 1), `ServerPicker`/`DirectoryServerHit` (Task 4).
- Produces: `TokenCalculatorTool()` component, default-exported `/tools/token-calculator` page.

- [ ] **Step 1: Create `components/tools/TokenCalculatorTool.tsx`**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { Card } from '../ui/Card';
import { ServerPicker, DirectoryServerHit } from './ServerPicker';
import { extractTools, computeToolTokens } from '../../lib/tools/tokenize';

const AVERAGE_TOKENS_PER_SERVER = 600;

const CONTEXT_WINDOWS = [
  { label: '128K (GPT-4 class)', size: 128000 },
  { label: '200K (Claude)', size: 200000 },
  { label: '1M (Claude long context)', size: 1000000 },
];

export function TokenCalculatorTool() {
  const [tab, setTab] = useState<'paste' | 'directory'>('paste');
  const [raw, setRaw] = useState('');
  const [selected, setSelected] = useState<DirectoryServerHit[]>([]);

  const pasteResult = useMemo(() => {
    if (!raw.trim()) return null;
    try {
      const parsed = JSON.parse(raw);
      const tools = extractTools(parsed);
      if (tools.length === 0) {
        return {
          error:
            'No tools found — expected a tools/list response ({"result":{"tools":[...]}}) or a bare array of {name, description, inputSchema}.',
        };
      }
      return computeToolTokens(tools);
    } catch (err) {
      return { error: (err as Error).message };
    }
  }, [raw]);

  const directoryTotal = selected.length * AVERAGE_TOKENS_PER_SERVER;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setTab('paste')}
          className={`btn btn-sm ${tab === 'paste' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Paste your tools JSON
        </button>
        <button
          onClick={() => setTab('directory')}
          className={`btn btn-sm ${tab === 'directory' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Quick estimate from directory
        </button>
      </div>

      {tab === 'paste' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Paste the raw <code>tools/list</code> JSON-RPC response from your MCP server (or a bare array of tool
            schemas). Counts use a GPT-4-class tokenizer as an approximation &mdash; exact counts vary by model.
          </p>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={14}
            className="form-input"
            style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
            placeholder='{"result": {"tools": [{"name": "search", "description": "...", "inputSchema": {}}]}}'
            aria-label="Paste your tools JSON"
          />
          {pasteResult && 'error' in pasteResult && (
            <div className="surface-muted" style={{ padding: '1rem', borderLeft: '3px solid #ef4444' }}>
              {pasteResult.error}
            </div>
          )}
          {pasteResult && 'total' in pasteResult && (
            <div>
              <h3 className="text-section" style={{ marginBottom: '0.5rem' }}>
                Total: {pasteResult.total.toLocaleString()} tokens
              </h3>
              <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                {CONTEXT_WINDOWS.map((w) => (
                  <li key={w.label}>
                    ≈ {((pasteResult.total / w.size) * 100).toFixed(2)}% of a {w.label} context window
                  </li>
                ))}
              </ul>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {pasteResult.breakdown.map((t) => (
                  <div
                    key={t.name}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.85rem',
                      borderBottom: '1px solid var(--border-color)',
                      padding: '0.4rem 0',
                    }}
                  >
                    <code>{t.name}</code>
                    <span>{t.tokens.toLocaleString()} tokens</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'directory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Rough estimate only &mdash; assumes ~{AVERAGE_TOKENS_PER_SERVER} tokens per server. Actual cost depends
            on each server's real tool count and schema complexity. Use "Paste your tools JSON" for an exact number.
          </p>
          <ServerPicker
            onSelect={(server) =>
              setSelected((s) => (s.some((x) => x.id === server.id) ? s : [...s, server]))
            }
          />
          {selected.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {selected.map((server) => (
                <Card
                  key={server.id}
                  style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <a href={`/mcp/${server.id}`} target="_blank" rel="noopener noreferrer">
                    {server.name}
                  </a>
                  <button
                    onClick={() => setSelected((s) => s.filter((x) => x.id !== server.id))}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </Card>
              ))}
              <h3 className="text-section" style={{ marginTop: '0.5rem' }}>
                ~{directoryTotal.toLocaleString()} tokens (estimate)
              </h3>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `app/tools/token-calculator/page.tsx`**

```tsx
import { Metadata } from 'next';
import { TokenCalculatorTool } from '../../../components/tools/TokenCalculatorTool';

export const metadata: Metadata = {
  title: 'MCP Token Cost Calculator — Estimate Context Window Usage',
  description:
    'Estimate how many tokens your MCP servers’ tool schemas cost against your context window. Paste real tool JSON for an exact count, or quick-estimate from the AllMCPs directory.',
  alternates: { canonical: 'https://allmcps.com/tools/token-calculator' },
  openGraph: {
    title: 'MCP Token Cost Calculator | AllMCPs',
    description: 'Estimate the context-window cost of your installed MCP servers’ tool schemas.',
    url: 'https://allmcps.com/tools/token-calculator',
  },
};

export default function TokenCalculatorPage() {
  return (
    <main className="page-shell page-shell--content">
      <div className="page-shell-inner">
        <div className="surface page-panel">
          <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>MCP Token Cost Calculator</h1>
          <p className="text-lead" style={{ marginBottom: '2rem' }}>
            Every MCP server you connect sends its tool definitions to the model on every turn. Estimate how much
            of your context window that's actually costing you.
          </p>

          <TokenCalculatorTool />

          <div style={{ marginTop: '3rem', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Why MCP servers have a token cost
            </h2>
            <p style={{ marginBottom: '1rem' }}>
              When an MCP client connects to a server, it asks for that server's list of tools &mdash; each with a
              name, a description, and a JSON Schema describing its parameters &mdash; and includes all of that in
              every request sent to the model, whether or not the model ends up calling any of those tools that
              turn. Connect enough servers, especially ones with many tools or verbose parameter schemas, and you
              can burn a meaningful slice of your context window before you've typed a single message.
            </p>
            <p>
              The "Paste your tools JSON" tab gives an exact count from your server's real <code>tools/list</code>{' '}
              response. The "Quick estimate from directory" tab is a rough, clearly-labeled approximation for
              browsing AllMCPs listings before you've installed anything &mdash; use the paste tab whenever you
              need a real number.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing either new file.

- [ ] **Step 4: Manual QA in the dev server**

Run: `npm run dev`, visit `http://localhost:3000/tools/token-calculator`, then:
1. On "Paste your tools JSON", paste `{"result":{"tools":[{"name":"search","description":"Search things","inputSchema":{"type":"object","properties":{"q":{"type":"string"}}}}]}}` and confirm a total token count and a one-row breakdown appear.
2. Paste invalid JSON and confirm the error message shows.
3. Paste valid JSON with no `tools` array (e.g. `{}`) and confirm the "No tools found" message shows.
4. Switch to "Quick estimate from directory", add 2-3 servers via search, confirm the running total updates and each row links to its `/mcp/[id]` page.

---

### Task 8: Tools hub page

**Files:**
- Create: `app/tools/page.tsx`

**Interfaces:**
- Consumes: `Card` (`components/ui/Card.tsx`), `lucide-react` icons.
- Produces: default-exported `/tools` page linking to the 3 subpages.

- [ ] **Step 1: Create `app/tools/page.tsx`**

```tsx
import { Metadata } from 'next';
import { Card } from '../../components/ui/Card';
import { FileJson, CheckCircle2, Calculator } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Free MCP Tools — Config Generator, Validator & Token Calculator',
  description:
    'Free browser-based tools for Model Context Protocol: generate a claude_desktop_config.json, validate your MCP config, and estimate tool schema token cost.',
  alternates: { canonical: 'https://allmcps.com/tools' },
  openGraph: {
    title: 'Free MCP Tools | AllMCPs',
    description:
      'Free browser-based tools for Model Context Protocol: config generator, config validator, and token cost calculator.',
    url: 'https://allmcps.com/tools',
  },
};

const TOOLS = [
  {
    href: '/tools/config-generator',
    icon: FileJson,
    title: 'Config Generator',
    description:
      'Build a ready-to-paste claude_desktop_config.json (or Cursor/VS Code/Windsurf equivalent) from servers in the directory or your own custom setup.',
  },
  {
    href: '/tools/config-validator',
    icon: CheckCircle2,
    title: 'Config Validator',
    description:
      'Paste your MCP config JSON and catch syntax errors and missing fields before you restart your client.',
  },
  {
    href: '/tools/token-calculator',
    icon: Calculator,
    title: 'Token Cost Calculator',
    description:
      "Estimate how much of your model's context window your installed MCP servers' tool schemas are using.",
  },
];

export default function ToolsHubPage() {
  return (
    <main className="page-shell page-shell--content">
      <div className="page-shell-inner">
        <div className="surface page-panel">
          <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>Free MCP Tools</h1>
          <p className="text-lead" style={{ marginBottom: '2rem' }}>
            Browser-based utilities for working with Model Context Protocol configs. Nothing you paste in ever
            leaves your device.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {TOOLS.map(({ href, icon: Icon, title, description }) => (
              <Card key={href} href={href} hoverable style={{ padding: '1.5rem' }}>
                <Icon size={28} style={{ color: 'var(--accent-color)', marginBottom: '1rem' }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>{title}</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{description}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing this file.

- [ ] **Step 3: Manual QA in the dev server**

Run: `npm run dev`, visit `http://localhost:3000/tools`, confirm all 3 cards render and link to their respective subpages (which should already work from Tasks 5-7).

---

### Task 9: Nav, footer, sitemap, and llms.txt wiring

**Files:**
- Modify: `components/SiteHeader.tsx`
- Modify: `components/SiteFooter.tsx`
- Modify: `app/sitemap.ts`
- Modify: `app/llms.txt/route.ts`

**Interfaces:** none — this task only adds links/entries to existing structures defined elsewhere in the codebase.

> **Before touching any file in this task:** other agents may be working on this branch concurrently. Re-read each file fresh right before editing (don't rely on the versions read earlier in this plan/session) and make the smallest diff that adds the new links — do not restructure surrounding code.

- [ ] **Step 1: Add "Tools" to the header nav**

In `components/SiteHeader.tsx`, the `NAV` array currently reads:

```ts
const NAV = [
  { href: '/browse', label: 'Browse' },
  { href: '/categories', label: 'Categories' },
  { href: '/what-is-mcp', label: 'What is MCP?' },
  { href: '/guide', label: 'Guides' },
] as const;
```

Add a `Tools` entry after `Guides` (both desktop and mobile nav already map over this same array, so one change covers both):

```ts
const NAV = [
  { href: '/browse', label: 'Browse' },
  { href: '/categories', label: 'Categories' },
  { href: '/what-is-mcp', label: 'What is MCP?' },
  { href: '/guide', label: 'Guides' },
  { href: '/tools', label: 'Tools' },
] as const;
```

- [ ] **Step 2: Add a "Free Tools" column to the footer**

In `components/SiteFooter.tsx`, add a new column between the existing "Resources" and "For AI & Agents" columns (the grid is `repeat(auto-fit, minmax(180px, 1fr))`, so a 5th column reflows safely):

```tsx
<div>
  <h4 className="footer-heading">Free Tools</h4>
  <ul className="site-footer-links">
    <li>
      <Link href="/tools/config-generator" className="nav-link">
        Config Generator
      </Link>
    </li>
    <li>
      <Link href="/tools/config-validator" className="nav-link">
        Config Validator
      </Link>
    </li>
    <li>
      <Link href="/tools/token-calculator" className="nav-link">
        Token Cost Calculator
      </Link>
    </li>
  </ul>
</div>
```

- [ ] **Step 3: Add sitemap entries**

In `app/sitemap.ts`, add these 4 entries to the `sitemapEntries` array, placed after the `/build-mcp-server` entry:

```ts
    {
      url: `${baseUrl}/tools`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tools/config-generator`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tools/config-validator`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tools/token-calculator`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
```

(Remember the `build-mcp-server` entry currently ends the array with `}` and no trailing comma before `];` — add a comma after it once you insert these.)

- [ ] **Step 4: Add the new pages to `llms.txt`**

In `app/llms.txt/route.ts`, the `Useful Links` section currently ends with:

```ts
  content += `## Useful Links\n`;
  content += `- Directory Homepage: https://allmcps.com\n`;
  content += `- Categories: https://allmcps.com/categories\n`;
  content += `- MCP Guide: https://allmcps.com/guide\n`;
  content += `- What is MCP: https://allmcps.com/what-is-mcp\n`;
```

Add one more line:

```ts
  content += `- Free Tools (Config Generator, Config Validator, Token Calculator): https://allmcps.com/tools\n`;
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual QA in the dev server**

Run: `npm run dev`, then:
1. Confirm "Tools" appears in the desktop header nav and the mobile drawer, and it's marked active (underline/highlight) when visiting `/tools` or any `/tools/*` page.
2. Scroll to the footer, confirm the new "Free Tools" column appears with 3 working links.
3. Visit `http://localhost:3000/sitemap.xml`, confirm `/tools` and the 3 subpages appear.
4. Visit `http://localhost:3000/llms.txt`, confirm the new line appears under "Useful Links".

---

## Final verification

- [ ] Run `npm run build` from the repo root and confirm it completes with no TypeScript or build errors across all new/modified files.
- [ ] Re-walk the manual QA steps from Tasks 5-9 once more end-to-end in the built output (`npm run build && npm run start`, or the dev server if `start` isn't configured for this project) to catch anything that only breaks in production mode (e.g. metadata/OG tags, JSON-LD if added later).
